import './globals.css';

export const metadata = {
  title: 'Club Attendance System',
  description: 'Anti-proxy attendance system',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-100 min-h-screen">{children}</body>
    </html>
  );
}
