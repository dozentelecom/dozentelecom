
import "./globals.css";
import Script from "next/script";
import PWAProvider from "@/components/pwa/PWAProvider";
import FloatingActions from "@/components/floating/FloatingActions";

export const metadata = {
  title: "Dozentelecom | Premium VTU",
  description:
    "Secure Nigerian VTU wallet and digital services",
  applicationName: "Dozentelecom",
  verification: {
    google: "oyfQUknhEuuQpUI_6IJrcpLNBgMLwZxOXym4KZEtzfw",
  },
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

        {/* Google Analytics 4 */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-TH94G93T18"
          strategy="afterInteractive"
        />

        <Script
          id="google-analytics"
          strategy="afterInteractive"
        >
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){window.dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-TH94G93T18');
          `}
        </Script>
      </body>
    </html>
  );
}
