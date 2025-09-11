export default function Card({ title, children }) {
  return (
    <div className="bg-white dark:bg-gray-700 p-6 shadow-lg rounded-lg">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
      <div className="text-lg mt-1 text-gray-800 dark:text-gray-100">{children}</div>
    </div>
  );
}
