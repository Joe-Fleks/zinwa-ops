import { useState, useRef } from 'react';
import { X, Camera, Phone, Upload, Loader2, Quote } from 'lucide-react';
import { supabase, UserProfile } from '../lib/supabase';

interface ProfileUpdateModalProps {
  profile: UserProfile;
  onClose: () => void;
  onSaved: () => void;
}

export default function ProfileUpdateModal({ profile, onClose, onSaved }: ProfileUpdateModalProps) {
  const [contact1, setContact1] = useState(profile.contact_number_1 || '');
  const [contact2, setContact2] = useState(profile.contact_number_2 || '');
  const [tagline, setTagline] = useState(profile.tagline || '');
  const [pictureFile, setPictureFile] = useState<File | null>(null);
  const [picturePreview, setPicturePreview] = useState<string | null>(profile.profile_picture_url || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const TAGLINE_MAX = 120;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, etc.)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be smaller than 2MB');
      return;
    }

    setError('');
    setPictureFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPicturePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      let pictureUrl = profile.profile_picture_url;

      if (pictureFile) {
        const ext = pictureFile.name.split('.').pop()?.toLowerCase() || 'jpg';
        const filePath = `${profile.id}/avatar.${ext}`;

        if (profile.profile_picture_url) {
          const oldPath = profile.profile_picture_url.split('/profile-pictures/')[1];
          if (oldPath) {
            await supabase.storage.from('profile-pictures').remove([oldPath]);
          }
        }

        const { error: uploadError } = await supabase.storage
          .from('profile-pictures')
          .upload(filePath, pictureFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('profile-pictures')
          .getPublicUrl(filePath);

        pictureUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      }

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          profile_picture_url: pictureUrl,
          contact_number_1: contact1.trim() || null,
          contact_number_2: contact2.trim() || null,
          tagline: tagline.trim() || null,
        })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Update Profile</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-col items-center gap-3">
            <div
              className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200 cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              {picturePreview ? (
                <img src={picturePreview} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-blue-600">
                  <span className="text-white text-3xl font-bold">
                    {profile.full_name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium transition"
            >
              <Upload className="w-3.5 h-3.5" />
              {picturePreview ? 'Change Photo' : 'Upload Photo'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <p className="text-xs text-gray-400">JPG or PNG, max 2MB</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
                <Quote className="w-3.5 h-3.5" />
                Tagline
              </label>
              <textarea
                value={tagline}
                onChange={(e) => {
                  if (e.target.value.length <= TAGLINE_MAX) setTagline(e.target.value);
                }}
                placeholder="e.g. Water treatment specialist | Murombedzi SC"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-none"
              />
              <p className="text-xs text-gray-400 text-right mt-0.5">{tagline.length}/{TAGLINE_MAX}</p>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
                <Phone className="w-3.5 h-3.5" />
                Primary Contact
              </label>
              <input
                type="tel"
                value={contact1}
                onChange={(e) => setContact1(e.target.value)}
                placeholder="e.g. +263 77 123 4567"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
                <Phone className="w-3.5 h-3.5" />
                Secondary Contact
              </label>
              <input
                type="tel"
                value={contact2}
                onChange={(e) => setContact2(e.target.value)}
                placeholder="e.g. +263 71 987 6543"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
