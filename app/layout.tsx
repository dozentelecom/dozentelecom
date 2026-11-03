
import "./globals.css";
import Script from "next/script";
import PWAProvider from "@/components/pwa/PWAProvider";
import FloatingActions from "@/components/floating/FloatingActions";
import MetaPixel from "@/components/analytics/MetaPixel";

export const metadata = {
  title: "Dozentelecom | Premium VTU",
  description: "Secure Nigerian VTU wallet and digital services",
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
        <MetaPixel />

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

        {/* Meta Pixel */}
        <Script
          id="meta-pixel"
          strategy="afterInteractive"
        >
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '1775319753756014');
            fbq('track', 'PageView');
          `}
        </Script>

        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=1775319753756014&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
      </body>
    </html>
  );
}
