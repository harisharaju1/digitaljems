import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function NotFoundPage() {
  const navigate = useNavigate();

  // Auto-redirect to home page
  useEffect(() => {
    navigate("/", { replace: true });
  }, [navigate]);

  return null;
}

export default NotFoundPage;
