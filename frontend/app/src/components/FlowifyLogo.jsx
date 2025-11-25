export default function FlowifyLogo({ size = 'lg' }) {
  const sizes = {
    sm: { svg: 'w-16 h-16', text: 'text-lg' },
    md: { svg: 'w-24 h-24', text: 'text-2xl' },
    lg: { svg: 'w-40 h-40', text: 'text-5xl' },
  };

  const { svg, text } = sizes[size];

  return (
    <div className="flex flex-col items-center gap-4">
      <svg className={`${svg}`} viewBox="0 0 200 400" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Top curve */}
        <path
          d="M 80 40 Q 140 80, 160 160"
          stroke="#3B82F6"
          strokeWidth="18"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 65 50 Q 125 90, 145 170"
          stroke="#60A5FA"
          strokeWidth="18"
          strokeLinecap="round"
          fill="none"
        />

        {/* Middle curve */}
        <path
          d="M 70 100 Q 130 140, 150 220"
          stroke="#3B82F6"
          strokeWidth="18"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 55 110 Q 115 150, 135 230"
          stroke="#60A5FA"
          strokeWidth="18"
          strokeLinecap="round"
          fill="none"
        />

        {/* Bottom curve */}
        <path
          d="M 60 160 Q 120 200, 140 280"
          stroke="#3B82F6"
          strokeWidth="18"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 45 170 Q 105 210, 125 290"
          stroke="#60A5FA"
          strokeWidth="18"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      <h1 className={`${text} font-bold text-blue-600`}>Flowify</h1>
    </div>
  );
}
