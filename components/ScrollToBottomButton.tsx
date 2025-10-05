interface ScrollToBottomButtonProps {
  onClick: () => void;
  show: boolean;
}

export default function ScrollToBottomButton({ onClick, show }: ScrollToBottomButtonProps) {
  if (!show) return null;

  return (
    <button
      onClick={onClick}
      className="absolute top-4 right-4 z-20 bg-white border-2 border-gray-300 rounded-full p-2 shadow-lg hover:shadow-xl transition-shadow hover:bg-gray-50"
      title="Ir al último mensaje"
    >
      <svg
        className="w-5 h-5 text-gray-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    </button>
  );
}
