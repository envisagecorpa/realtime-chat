/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6', // Blue for active elements, links
        secondary: '#10B981', // Green for success/checkmarks
        danger: '#EF4444', // Red for errors, failed messages
        muted: '#6B7280', // Gray for timestamps, secondary text
      },
      spacing: {
        'chat-input': '4rem', // Fixed height for chat input area
        sidebar: '16rem', // Fixed width for room list sidebar
      },
      fontSize: {
        message: '0.9375rem', // 15px for message content
        timestamp: '0.75rem', // 12px for timestamps
      },
    },
  },
  plugins: [],
};
