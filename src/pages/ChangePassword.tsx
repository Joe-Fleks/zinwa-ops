import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle, CheckCircle } from 'lucide-react';

export function ChangePassword() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validatePassword = (pwd: string): string[] => {
    const errors: string[] = [];
    if (pwd.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    if (!/[a-z]/.test(pwd)) {
      errors.push('Password must contain lowercase letters');
    }
    if (!/[A-Z]/.test(pwd)) {
      errors.push('Password must contain uppercase letters');
    }
    if (!/[0-9]/.test(pwd)) {
      errors.push('Password must contain numbers');
    }
    return errors;
  };

  const handlePasswordChange = (pwd: string) => {
    setPassword(pwd);
    const errors = validatePassword(pwd);
    if (errors.length > 0) {
      setValidationErrors({ password: errors.join(', ') });
    } else {
      setValidationErrors(prev => ({ ...prev, password: '' }));
    }
  };

  const handleConfirmPasswordChange = (pwd: string) => {
    setConfirmPassword(pwd);
    if (pwd && password && pwd !== password) {
      setValidationErrors(prev => ({ ...prev, confirm: 'Passwords do not match' }));
    } else {
      setValidationErrors(prev => ({ ...prev, confirm: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Final validation
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      setError(passwordErrors.join(', '));
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!user) {
      setError('No active user session');
      return;
    }

    setLoading(true);
    try {
      console.log('[PASSWORD CHANGE] Starting password update...');

      // Check current session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      console.log('[PASSWORD CHANGE] Session check:', {
        sessionExists: !!sessionData?.session,
        sessionError: sessionError?.message || 'none',
        userId: sessionData?.session?.user?.id,
        userEmail: sessionData?.session?.user?.email,
        expiresAt: sessionData?.session?.expires_at,
        hasAccessToken: !!sessionData?.session?.access_token,
      });

      if (!sessionData?.session) {
        console.error('[PASSWORD CHANGE] NO ACTIVE SESSION — password update cannot proceed');
        throw new Error('No active session. Please log in again.');
      }

      // Update password in auth
      console.log('[PASSWORD CHANGE] Calling updateUser with new password...');
      const { data: updateData, error: updateError } = await supabase.auth.updateUser({ password });

      console.log('[PASSWORD CHANGE] updateUser response:', {
        hasData: !!updateData,
        hasError: !!updateError,
        errorMessage: updateError?.message,
        errorStatus: (updateError as any)?.status,
        errorCode: (updateError as any)?.code,
        fullError: updateError,
      });

      if (updateError) throw updateError;

      console.log('[PASSWORD CHANGE] Password updated successfully in auth');

      // Update force_password_reset flag
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ force_password_reset: false })
        .eq('id', user.id);

      if (profileError) {
        console.error('[PASSWORD CHANGE] Profile update error:', profileError);
        throw profileError;
      }

      console.log('[PASSWORD CHANGE] Profile updated: force_password_reset set to false');

      // Log event
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action_type: 'PASSWORD_UPDATED',
        entity_type: 'user',
        entity_id: user.id,
        previous_value: { reason: 'first_login_change' },
        new_value: { password_changed: true },
      });

      console.log('[PASSWORD CHANGE] Successfully updated password and logged event');
      setSuccess(true);
      sessionStorage.removeItem('forcePasswordReset');

      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update password';
      console.error('[PASSWORD CHANGE] Error details:', {
        message: errorMessage,
        fullError: err,
        type: typeof err,
      });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Set Your Password</h1>
          <p className="text-slate-600 mb-6">This is your first login. Please set a strong password to secure your account.</p>

          {success && (
            <div className="mb-6 flex items-center gap-3 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <p className="text-emerald-700 text-sm">Password updated successfully! Redirecting...</p>
            </div>
          )}

          {error && (
            <div className="mb-6 flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                New Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={e => handlePasswordChange(e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition ${
                  validationErrors.password
                    ? 'border-red-300 focus:ring-red-200'
                    : 'border-slate-300 focus:ring-blue-200'
                }`}
                placeholder="Enter new password"
              />
              {validationErrors.password && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.password}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-slate-700 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirm"
                value={confirmPassword}
                onChange={e => handleConfirmPasswordChange(e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition ${
                  validationErrors.confirm
                    ? 'border-red-300 focus:ring-red-200'
                    : 'border-slate-300 focus:ring-blue-200'
                }`}
                placeholder="Confirm password"
              />
              {validationErrors.confirm && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.confirm}</p>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900 font-medium mb-2">Password requirements:</p>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>At least 8 characters</li>
                <li>Mix of uppercase and lowercase letters</li>
                <li>At least one number</li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={loading || !password || !confirmPassword || !!validationErrors.password || !!validationErrors.confirm}
              className="w-full py-2 px-4 bg-blue-200 text-blue-900 rounded-lg font-medium hover:bg-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Updating...' : 'Set Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
