import { Navigate } from 'react-router-dom';

/** Registration is now handled inside LoginPage (tab="signup"). */
export default function RegisterPage() {
  return <Navigate to="/login?tab=signup" replace />;
}
