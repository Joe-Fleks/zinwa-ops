import RWMonthlyGrid from './RWMonthlyGrid';

type SubTab = 'sales' | 'outputs';

interface RWTargetsTabProps {
  subView: SubTab;
}

export default function RWTargetsTab({ subView }: RWTargetsTabProps) {
  if (subView === 'outputs') {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">Outputs section coming soon</p>
          <p className="text-sm mt-2">This section will display performance analytics and outputs</p>
        </div>
      </div>
    );
  }

  return <RWMonthlyGrid title="RW Sales Targets" tableName="rw_sales_targets" />;
}
