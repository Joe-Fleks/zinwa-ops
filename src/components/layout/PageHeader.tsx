import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  backTo?: string;
  subtitle?: string;
  icon?: React.ReactNode;
}

export default function PageHeader({ title, backTo, subtitle, icon }: PageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (backTo) {
      navigate(backTo);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={handleBack}
          className="p-2 hover:bg-gray-200 rounded-lg transition text-gray-700"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        {icon && <div className="bg-blue-100 p-2 rounded-lg">{icon}</div>}
      </div>
      <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
      {subtitle && <p className="text-gray-600 text-sm mt-1">{subtitle}</p>}
    </div>
  );
}
