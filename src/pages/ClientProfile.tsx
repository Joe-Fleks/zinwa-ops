import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Save, AlertCircle, CheckCircle2, User, FileText } from 'lucide-react';

interface WaterUser {
  user_id: string;
  client_company_name: string;
  national_id_no: string;
  account_no: string;
  contact_1: string;
  contact_2: string;
  email: string;
}

interface Allocation {
  allocation_id: string;
  source: string;
  property_name: string;
  category: string;
  water_allocated_ml: number;
  agreement_start_date: string;
  agreement_expiry_date: string;
  agreement_length_months: number | null;
  district: string;
  hectrage: number;
  crop: string;
  crop_category: string;
}

export default function ClientProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clientData, setClientData] = useState<WaterUser | null>(null);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editedClient, setEditedClient] = useState<WaterUser | null>(null);

  useEffect(() => {
    if (userId) {
      loadClientData();
    }
  }, [userId]);

  const loadClientData = async () => {
    setLoading(true);
    try {
      const [clientRes, allocationsRes] = await Promise.all([
        supabase
          .from('water_users')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('rw_allocations')
          .select('*')
          .eq('user_id', userId)
          .order('agreement_start_date', { ascending: false })
      ]);

      if (clientRes.error) throw clientRes.error;
      if (allocationsRes.error) throw allocationsRes.error;

      setClientData(clientRes.data);
      setEditedClient(clientRes.data);
      setAllocations(allocationsRes.data || []);
    } catch (error) {
      console.error('Error loading client data:', error);
      setMessage({ type: 'error', text: 'Failed to load client data' });
    } finally {
      setLoading(false);
    }
  };

  const handleClientUpdate = (field: keyof WaterUser, value: string) => {
    if (editedClient) {
      setEditedClient({ ...editedClient, [field]: value });
    }
  };

  const saveClient = async () => {
    if (!user || !editedClient) {
      setMessage({ type: 'error', text: 'User not authenticated or no data to save' });
      return;
    }

    if (!editedClient.client_company_name.trim()) {
      setMessage({ type: 'error', text: 'Client/Company Name is required' });
      return;
    }

    if (!editedClient.account_no.trim()) {
      setMessage({ type: 'error', text: 'Account Number is required' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('water_users')
        .update({
          client_company_name: editedClient.client_company_name,
          national_id_no: editedClient.national_id_no || null,
          account_no: editedClient.account_no,
          contact_1: editedClient.contact_1 || null,
          contact_2: editedClient.contact_2 || null,
          email: editedClient.email || null
        })
        .eq('user_id', userId);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Client information updated successfully' });
      setClientData(editedClient);
    } catch (error: any) {
      console.error('Error saving client:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save client information' });
    } finally {
      setSaving(false);
    }
  };

  const calculateTotalWaterAllocated = () => {
    return allocations.reduce((sum, a) => sum + (a.water_allocated_ml || 0), 0);
  };

  const isExpired = (expiryDate: string) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading client profile...</p>
        </div>
      </div>
    );
  }

  if (!clientData || !editedClient) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => navigate('/rawwater')}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-900 font-medium mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to RW Database
          </button>
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Client Not Found</h2>
            <p className="text-gray-600">The requested client profile could not be found.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <button
          onClick={() => navigate('/rawwater')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-900 font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to RW Database
        </button>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">RW Client Profile</h1>
            <p className="text-gray-600 mt-1">{clientData.client_company_name}</p>
          </div>
          <button
            onClick={saveClient}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-200 text-blue-900 rounded-lg hover:bg-blue-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {message && (
          <div className={`p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-6">
            <User className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Client Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Client / Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editedClient.client_company_name}
                onChange={(e) => handleClientUpdate('client_company_name', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                National ID No.
              </label>
              <input
                type="text"
                value={editedClient.national_id_no}
                onChange={(e) => handleClientUpdate('national_id_no', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account No. <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editedClient.account_no}
                onChange={(e) => handleClientUpdate('account_no', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contact 1
              </label>
              <input
                type="text"
                value={editedClient.contact_1}
                onChange={(e) => handleClientUpdate('contact_1', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contact 2
              </label>
              <input
                type="text"
                value={editedClient.contact_2}
                onChange={(e) => handleClientUpdate('contact_2', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={editedClient.email}
                onChange={(e) => handleClientUpdate('email', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Water Allocations</h2>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Total Water Allocated</p>
              <p className="text-2xl font-bold text-blue-600">{calculateTotalWaterAllocated().toFixed(2)} ML</p>
            </div>
          </div>

          {allocations.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No allocations found for this client</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Source</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Property</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">District</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Hectrage</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Crop</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Crop Category</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Start Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Expiry Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Length (months)</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Water (ML)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {allocations.map((allocation) => {
                    const expired = isExpired(allocation.agreement_expiry_date);
                    return (
                      <tr key={allocation.allocation_id} className={expired ? 'bg-red-50' : 'hover:bg-gray-50'}>
                        <td className="px-4 py-3">{allocation.source || '-'}</td>
                        <td className="px-4 py-3">{allocation.property_name || '-'}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                            {allocation.category || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3">{allocation.district || '-'}</td>
                        <td className="px-4 py-3">{allocation.hectrage?.toFixed(2) || '-'}</td>
                        <td className="px-4 py-3">{allocation.crop || '-'}</td>
                        <td className="px-4 py-3">
                          {allocation.crop_category ? (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                              {allocation.crop_category}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {allocation.agreement_start_date
                            ? new Date(allocation.agreement_start_date).toLocaleDateString()
                            : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {allocation.agreement_expiry_date
                              ? new Date(allocation.agreement_expiry_date).toLocaleDateString()
                              : '-'}
                            {expired && (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                                Expired
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">{allocation.agreement_length_months ?? '-'}</td>
                        <td className="px-4 py-3 font-semibold">{allocation.water_allocated_ml?.toFixed(2) || '0.00'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
