<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

ini_set('session.cookie_httponly', '1');
ini_set('session.use_strict_mode', '1');
session_name('VIDEOWALLSESSID');
session_start();

$method = $_SERVER['REQUEST_METHOD'];
$path   = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

$db = new PDO('sqlite:' . __DIR__ . '/videowall.db');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$db->exec("
CREATE TABLE IF NOT EXISTS videowalls (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY,
  videowall_id TEXT NOT NULL,
  name TEXT NOT NULL,
  duration_sec INTEGER NOT NULL DEFAULT 15,
  sort_order INTEGER NOT NULL DEFAULT 1,
  mode TEXT NOT NULL DEFAULT 'normal'
);
CREATE TABLE IF NOT EXISTS widgets (
  id TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL,
  type TEXT NOT NULL,
  config_json TEXT NOT NULL,
  x INTEGER NOT NULL, y INTEGER NOT NULL, w INTEGER NOT NULL, h INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','viewer'))
);
CREATE TABLE IF NOT EXISTS player_freeze (
  videowall_id TEXT PRIMARY KEY,
  scene_id TEXT,
  frozen INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
");

if ((int)$db->query("SELECT COUNT(*) FROM videowalls")->fetchColumn() === 0) {
  $db->prepare("INSERT INTO videowalls(id,name) VALUES(?,?)")->execute(['vw1','Main TV']);
}
function seed_user($db,$u,$p,$r){
  $st=$db->prepare("SELECT 1 FROM users WHERE username=?"); $st->execute([$u]);
  if(!$st->fetch()){ $db->prepare("INSERT INTO users(username,password_hash,role) VALUES(?,?,?)")
      ->execute([$u, password_hash($p, PASSWORD_DEFAULT), $r]); }
}
seed_user($db,'admin','admin123','admin');
seed_user($db,'viewer','viewer123','viewer');

function json() { return json_decode(file_get_contents('php://input'), true) ?? []; }
function out($x, $code=200){ http_response_code($code); echo json_encode($x, JSON_UNESCAPED_SLASHES); exit; }
function notfound(){ out(['error'=>'not found'],404); }
function bad($msg, $code=400){ out(['error'=>$msg], $code); }

function current_user($db){
  if (empty($_SESSION['uid'])) return null;
  $st=$db->prepare("SELECT id,username,role FROM users WHERE id=?"); $st->execute([$_SESSION['uid']]);
  return $st->fetch(PDO::FETCH_ASSOC) ?: null;
}
function require_auth($db){
  $u=current_user($db); if(!$u) out(['error'=>'unauthorized'],401);
  return $u;
}
function require_admin($db){
  $u=require_auth($db); if($u['role']!=='admin') out(['error'=>'forbidden'],403);
  return $u;
}

/* - Auth - */

if ($path==='/api/login' && $method==='POST') {
  $b=json();
  $st=$db->prepare("SELECT id,username,role,password_hash FROM users WHERE username=?");
  $st->execute([$b['username'] ?? '']);
  $row=$st->fetch(PDO::FETCH_ASSOC);
  if(!$row || !password_verify($b['password'] ?? '', $row['password_hash'])) out(['error'=>'invalid'],401);
  session_regenerate_id(true);
  $_SESSION['uid']=$row['id'];
  out(['id'=>$row['id'], 'name'=>$row['username'], 'role'=>$row['role']]);
}
if ($path==='/api/logout' && $method==='POST') {
  $_SESSION=[]; session_destroy(); out(['ok'=>true]);
}
if ($path==='/api/me' && $method==='GET') {
  $u=current_user($db);
  if(!$u) out(['authenticated'=>false]);
  out(['authenticated'=>true, 'id'=>$u['id'], 'name'=>$u['username'], 'role'=>$u['role']]);
}

/* - Videowalls (auth required for read; admin for write) - */

if ($path === '/api/videowalls' && $method === 'GET') { require_auth($db);
  $rows = $db->query("SELECT id,name FROM videowalls ORDER BY name")->fetchAll(PDO::FETCH_ASSOC); out($rows); }
if ($path === '/api/videowalls' && $method === 'POST') { require_admin($db);
  $b=json(); $id = $b['id'] ?? ('vw_'.bin2hex(random_bytes(5))); $name = trim($b['name'] ?? '');
  if ($name==='') bad('name required');
  $db->prepare("INSERT INTO videowalls(id,name) VALUES(?,?)")->execute([$id,$name]); out(['id'=>$id],201); }
if (preg_match('#^/api/videowalls/([^/]+)$#', $path, $m) && $method==='PUT') { require_admin($db);
  $id=$m[1]; $b=json(); $name=trim($b['name'] ?? ''); if($name==='') bad('name required');
  $db->prepare("UPDATE videowalls SET name=? WHERE id=?")->execute([$name,$id]); out(['ok'=>true]); }
if (preg_match('#^/api/videowalls/([^/]+)$#', $path, $m) && $method==='DELETE') { require_admin($db);
  $id=$m[1];
  $db->beginTransaction();
  try {
    $s=$db->prepare("SELECT id FROM scenes WHERE videowall_id=?"); $s->execute([$id]);
    $sc=$s->fetchAll(PDO::FETCH_COLUMN,0);
    if ($sc) {
      $in=implode(',', array_fill(0,count($sc),'?'));
      $db->prepare("DELETE FROM widgets WHERE scene_id IN ($in)")->execute($sc);
      $db->prepare("DELETE FROM scenes WHERE id IN ($in)")->execute($sc);
    }
    $db->prepare("DELETE FROM player_freeze WHERE videowall_id=?")->execute([$id]);
    $db->prepare("DELETE FROM videowalls WHERE id=?")->execute([$id]);
    $db->commit();
  } catch(Exception $e){ $db->rollBack(); bad('delete failed',500); }
  out(['ok'=>true]); }

/* - Scenes / Widgets (auth read; admin write) - */

if (preg_match('#^/api/videowalls/([^/]+)/scenes$#', $path, $m) && $method==='GET') { require_auth($db);
  $vw=$m[1]; $mode=$_GET['mode'] ?? null;
  $sql="SELECT id,name,duration_sec as duration, sort_order as `order`, mode FROM scenes WHERE videowall_id=? "; $p=[$vw];
  if($mode){ $sql.=" AND mode=? "; $p[]=$mode; }
  $sql.=" ORDER BY sort_order ASC"; $st=$db->prepare($sql); $st->execute($p); out($st->fetchAll(PDO::FETCH_ASSOC)); }
if (preg_match('#^/api/videowalls/([^/]+)/playlist$#', $path, $m) && $method==='GET') { require_auth($db);
  $vw=$m[1]; $mode=$_GET['mode'] ?? null;
  $sql="SELECT * FROM scenes WHERE videowall_id=? "; $p=[$vw]; if($mode){ $sql.=" AND mode=? "; $p[]=$mode; }
  $sql.=" ORDER BY sort_order ASC"; $sc=$db->prepare($sql); $sc->execute($p);
  $out=[]; foreach($sc->fetchAll(PDO::FETCH_ASSOC) as $s){
    $w=$db->prepare("SELECT id,type,config_json,x,y,w,h FROM widgets WHERE scene_id=?"); $w->execute([$s['id']]);
    $widgets=[]; foreach($w->fetchAll(PDO::FETCH_ASSOC) as $row){
      $widgets[]=['id'=>$row['id'],'type'=>$row['type'],'config'=>json_decode($row['config_json'],true),
        'layout'=>['i'=>$row['id'],'x'=>(int)$row['x'],'y'=>(int)$row['y'],'w'=>(int)$row['w'],'h'=>(int)$row['h']]];
    }
    $out[]=['id'=>$s['id'],'videowall_id'=>$s['videowall_id'],'name'=>$s['name'],
      'duration'=>(int)$s['duration_sec'],'order'=>(int)$s['sort_order'],'mode'=>$s['mode'],'widgets'=>$widgets];
  } out($out); }
if (preg_match('#^/api/scenes/([^/]+)$#', $path, $m) && $method==='GET') { require_auth($db);
  $id=$m[1];
  $s=$db->prepare("SELECT * FROM scenes WHERE id=?"); $s->execute([$id]); $scene=$s->fetch(PDO::FETCH_ASSOC); if(!$scene) notfound();
  $w=$db->prepare("SELECT id,type,config_json,x,y,w,h FROM widgets WHERE scene_id=?"); $w->execute([$id]);
  $widgets=[]; foreach($w->fetchAll(PDO::FETCH_ASSOC) as $row){
    $widgets[]=['id'=>$row['id'],'type'=>$row['type'],'config'=>json_decode($row['config_json'],true),
      'layout'=>['i'=>$row['id'],'x'=>(int)$row['x'],'y'=>(int)$row['y'],'w'=>(int)$row['w'],'h'=>(int)$row['h']]];
  }
  out(['id'=>$scene['id'],'videowall_id'=>$scene['videowall_id'],'name'=>$scene['name'],
    'duration'=>(int)$scene['duration_sec'],'order'=>(int)$scene['sort_order'],'mode'=>$scene['mode'],'widgets'=>$widgets]); }
if ($path==='/api/scenes' && $method==='POST') { require_admin($db);
  $b=json(); $id=$b['id'] ?? ('s_'.bin2hex(random_bytes(6)));
  $db->prepare("INSERT INTO scenes(id,videowall_id,name,duration_sec,sort_order,mode) VALUES(?,?,?,?,?,?)")
     ->execute([$id,$b['videowall_id'],$b['name'],$b['duration']??15,$b['order']??1,$b['mode']??'normal']);
  if (!empty($b['widgets'])) {
    $ins=$db->prepare("INSERT INTO widgets(id,scene_id,type,config_json,x,y,w,h) VALUES(?,?,?,?,?,?,?,?)");
    foreach ($b['widgets'] as $w) {
      $wid=$w['id'] ?? ('w_'.bin2hex(random_bytes(6)));
      $cfg=json_encode($w['config'] ?? []);
      $x=$w['layout']['x']??0; $y=$w['layout']['y']??0; $W=$w['layout']['w']??4; $H=$w['layout']['h']??3;
      $ins->execute([$wid,$id,$w['type'],$cfg,$x,$y,$W,$H]);
    }
  }
  out(['id'=>$id],201); }
if (preg_match('#^/api/scenes/([^/]+)$#', $path, $m) && $method==='PUT') { require_admin($db);
  $id=$m[1]; $b=json();
  $db->prepare("UPDATE scenes SET name=?, duration_sec=?, sort_order=?, mode=? WHERE id=?")
     ->execute([$b['name'],$b['duration']??15,$b['order']??1,$b['mode']??'normal',$id]);
  $db->prepare("DELETE FROM widgets WHERE scene_id=?")->execute([$id]);
  if (!empty($b['widgets'])) {
    $ins=$db->prepare("INSERT INTO widgets(id,scene_id,type,config_json,x,y,w,h) VALUES(?,?,?,?,?,?,?,?)");
    foreach ($b['widgets'] as $w) {
      $wid=$w['id'] ?? ('w_'.bin2hex(random_bytes(6)));
      $cfg=json_encode($w['config'] ?? []);
      $x=$w['layout']['x']??0; $y=$w['layout']['y']??0; $W=$w['layout']['w']??4; $H=$w['layout']['h']??3;
      $ins->execute([$wid,$id,$w['type'],$cfg,$x,$y,$W,$H]);
    }
  }
  out(['ok'=>true]); }
if (preg_match('#^/api/scenes/([^/]+)$#', $path, $m) && $method==='DELETE') { require_admin($db);
  $id=$m[1]; $db->prepare("DELETE FROM widgets WHERE scene_id=?")->execute([$id]); $db->prepare("DELETE FROM scenes WHERE id=?")->execute([$id]); out(['ok'=>true]); }

/* - Player Freeze (auth read; admin write) - */

if (preg_match('#^/api/player/([^/]+)/freeze$#', $path, $m)) {
  $vw = $m[1];
  if ($method==='GET') { require_auth($db);
    $st=$db->prepare("SELECT scene_id, frozen FROM player_freeze WHERE videowall_id=?"); $st->execute([$vw]);
    $row=$st->fetch(PDO::FETCH_ASSOC);
    out(['frozen'=> (bool)($row['frozen'] ?? 0), 'sceneId'=> $row['scene_id'] ?? null]);
  }
  if ($method==='POST') { require_admin($db);
    $b=json(); $sceneId = $b['sceneId'] ?? null; if (!$sceneId) bad('sceneId required');
    $db->prepare("
      INSERT INTO player_freeze(videowall_id, scene_id, frozen, updated_at)
      VALUES(?,?,1,strftime('%s','now'))
      ON CONFLICT(videowall_id) DO UPDATE SET scene_id=excluded.scene_id, frozen=1, updated_at=strftime('%s','now')
    ")->execute([$vw,$sceneId]); out(['ok'=>true]);
  }
  if ($method==='DELETE') { require_admin($db);
    $db->prepare("
      INSERT INTO player_freeze(videowall_id, scene_id, frozen, updated_at)
      VALUES(?,NULL,0,strftime('%s','now'))
      ON CONFLICT(videowall_id) DO UPDATE SET scene_id=NULL, frozen=0, updated_at=strftime('%s','now')
    ")->execute([$vw]); out(['ok'=>true]);
  }
}

/* - Alerts / presence (auth read) - */

if ($path==='/api/alerts/summary' && $method==='GET') { require_auth($db); out(['open'=>12,'closed_without_reason'=>2,'closed_with_reason'=>9,'critical'=>0]); }
if ($path==='/api/alerts/critical' && $method==='GET') { require_auth($db); out(['hasCritical'=>false]); }
if ($path==='/api/visitor/presence' && $method==='GET') { require_auth($db); out(['present'=>false]); }

http_response_code(404);
echo json_encode(['error'=>'not found']);
