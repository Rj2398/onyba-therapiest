import type { Metadata } from "next";
import "./globals.css";
import AppShell from "../component/AppShell";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "Onyba",
  description: "Onyba Website",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link href="/styles/all.min.css" rel="stylesheet" type="text/css" />
        <link href="/styles/bootstrap.min.css" rel="stylesheet" type="text/css" />
        <link href="/styles/layout.css" rel="stylesheet" type="text/css" />
        <link href="/styles/style.css" rel="stylesheet" type="text/css" />
        <script src="/js/jquery.js" defer />
        <script src="/js/bootstrap.min.js" defer />
        <script src="/js/layout.js" defer />
        <script src="/js/main.js" defer />
      </head>
      <body>
        <AppShell>{children}</AppShell>
        <ToastContainer />
        <Toaster position="top-center" />
      </body>
    </html>
  );
}