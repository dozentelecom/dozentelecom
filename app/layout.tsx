import "./globals.css";
import PWAProvider from "@/components/pwa/PWAProvider";
import FloatingActions from "@/components/floating/FloatingActions";

export const metadata = {
  title: "Dozentelecom | Premium VTU",
  description:
    "Secure Nigerian VTU wallet and digital services",
  applicationName: "Dozentelecom",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        {children}

        <PWAProvider />

        <FloatingActions />
      </body>
    </html>
  );
}