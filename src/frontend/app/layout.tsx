import "./assets/css/main.css";
import type { Metadata } from "next";
import Navigation from "./components/Navigation";
import Notification from "./components/Notification";
import ReduxProvider from "./lib/reduxProvider";
import Footer from "./components/Footer";
import FallAlertBanner from "./components/alerts/FallAlertBanner";


export const metadata: Metadata = {
  title: "FastAPI/React starter stack",
  description: "Accelerate your next web development project",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ReduxProvider>
      <html lang="en">
        <body>
          <div className="bg-white">
            <slot name="header">
              <Navigation />
              <FallAlertBanner />
            </slot>
          </div>
          {children}
          <slot name="footer">
            <Notification />
            <Footer />
          </slot>
        </body>
      </html>
    </ReduxProvider>
  );
}
