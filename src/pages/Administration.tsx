import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Users, Shield, FileText } from 'lucide-react';

export default function Administration() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const modules = [
    {
      path: '/admin/users',
      title: 'User Management',
      description: 'Register users, assign roles, and manage access',
      icon: Users,
      permission: 'manage_users',
    },
    {
      path: '/admin/roles',
      title: 'Role Management',
      description: 'Create and manage roles and permissions',
      icon: Shield,
      permission: 'manage_roles',
    },
    {
      path: '/admin/audit-logs',
      title: 'Audit Logs',
      description: 'View system activity and change history',
      icon: FileText,
      permission: 'manage_users',
    },
  ];

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Administration</h1>
        <p className="text-gray-600">System administration and governance tools</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {modules.map((module) => {
          const Icon = module.icon;
          const canAccess = hasPermission(module.permission);

          return (
            <button
              key={module.path}
              onClick={() => canAccess && navigate(module.path)}
              disabled={!canAccess}
              className={`text-left p-6 rounded-lg border-2 transition-all ${
                canAccess
                  ? 'bg-white border-blue-200 hover:border-blue-500 hover:shadow-md cursor-pointer'
                  : 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
              }`}
            >
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${
                  canAccess ? 'bg-blue-100' : 'bg-gray-100'
                }`}
              >
                <Icon className={`w-6 h-6 ${canAccess ? 'text-blue-600' : 'text-gray-400'}`} />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{module.title}</h3>
              <p className={`text-sm ${canAccess ? 'text-gray-600' : 'text-gray-500'}`}>
                {module.description}
              </p>
              {!canAccess && (
                <p className="text-xs text-red-600 mt-4 font-medium">Access Restricted</p>
              )}
            </button>
          );
        })}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">Administration Guidelines</h3>
        <ul className="text-sm text-blue-800 space-y-2">
          <li>• Only administrators can access this section</li>
          <li>• All administrative actions are logged in audit logs</li>
          <li>• Users must be pre-registered before they can sign in</li>
          <li>• Role assignments become effective immediately</li>
          <li>• Audit logs are immutable and cannot be deleted</li>
        </ul>
      </div>
    </div>
  );
}
