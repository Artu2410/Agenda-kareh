import { Navigate } from 'react-router-dom';
import { APP_ROUTES } from '../../utils/appRoutes';
import { hasAnyRole } from '../../utils/roles';

const RequireRole = ({ role, roles = [], fallbackTo = APP_ROUTES.dashboard, children }) => {
  if (!roles || roles.length === 0 || hasAnyRole(role, roles)) {
    return children;
  }

  return <Navigate to={fallbackTo} replace />;
};

export default RequireRole;
