import { RouterProvider } from "react-router-dom";

import ToastViewport from "@/components/Toast/ToastViewport";
import { router } from "@/routes";

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <ToastViewport />
    </>
  );
}
