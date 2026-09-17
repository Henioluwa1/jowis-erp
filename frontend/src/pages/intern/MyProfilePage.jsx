import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Badge } from '../../components/common/Badge';
import {
  User,
  GraduationCap,
  Users,
  Award,
  Calendar,
  Phone,
  Mail,
  MapPin,
  BookOpen,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck
} from 'lucide-react';

export const MyProfilePage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get('/dashboard/intern');
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load intern profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleUpdateContact = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const res = await api.put(`/interns/${data.profile.id}`, { phone, address });
      if (res.data.success) {
        setMessage('Contact details updated successfully.');
        setEditing(false);
        fetchProfile();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update contact info.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!data) {
    return <div className="erp-card p-6 text-slate-400">Unable to load profile data.</div>;
  }

  const { profile, attendanceStats, performance } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <User className="w-6 h-6 text-brand-400" />
          <span>My Official Intern Profile</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Your official institutional enrollment details, academic track, assigned cohort, and mentor records.
        </p>
      </div>

      {message && (
        <div className="p-4 bg-emerald-950/70 border border-emerald-800 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-950/70 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Profile Header Card */}
      <div className="erp-card p-6 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-xl font-bold text-white shadow-xl shadow-brand-500/20">
              {profile.name?.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-brand-950 text-brand-300 border border-brand-800/60 font-bold">
                  {profile.internCode}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-xs text-slate-400">{profile.email}</span>
              </div>
              <h3 className="text-2xl font-extrabold text-white">{profile.name}</h3>
              <p className="text-xs text-slate-300 mt-1">
                Enrolled Candidate in <strong className="text-white">{profile.track}</strong>
              </p>
            </div>
          </div>
          <div className="self-start md:self-auto flex items-center gap-3">
            <Badge status={profile.status} text={`Lifecycle: ${profile.status}`} />
          </div>
        </div>
      </div>

      {/* Academic Placement Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="erp-card p-5 space-y-2">
          <div className="flex items-center gap-2 text-brand-400 text-xs font-semibold uppercase tracking-wider">
            <GraduationCap className="w-4 h-4" />
            <span>Assigned Track</span>
          </div>
          <p className="text-base font-bold text-white">{profile.track}</p>
          <p className="text-[11px] text-slate-400">Technical specialization curriculum</p>
        </div>

        <div className="erp-card p-5 space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            <Users className="w-4 h-4" />
            <span>Assigned Cohort</span>
          </div>
          <p className="text-base font-bold text-white">{profile.cohort}</p>
          <p className="text-[11px] text-slate-400">Official batch group</p>
        </div>

        <div className="erp-card p-5 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Assigned Lead Mentor</span>
          </div>
          <p className="text-base font-bold text-white">{profile.mentor}</p>
          <p className="text-[11px] text-slate-400">Senior technical supervisor</p>
        </div>
      </div>

      {/* Institutional Placement Notice */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-slate-200">Institutional Governance Policy</p>
          <p className="leading-relaxed">
            Your Track, Cohort, and Lead Mentor are formally managed by Jowis Studio ERP administration. If you require a track change or cohort deferral, please consult your Lead Mentor or contact Administration.
          </p>
        </div>
      </div>
    </div>
  );
};
