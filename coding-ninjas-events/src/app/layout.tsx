import type { Metadata } from "next";
import "./globals.css";


// exporting metadata for the application:
export const metadata: Metadata = {
  title: "Events Page: Coding-Ninjas",
  description: "This is events page for CN-CUIET",
};


// Root layout component for the application:
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={``}
      >
        {children}
      </body>
    </html>
  );
};