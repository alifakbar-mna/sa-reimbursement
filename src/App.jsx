// src/App.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';

export default function App() {
  // State Akses Pintu Gerbang (Role)
  const [userRole, setUserRole] = useState(null); // 'request', 'sa', atau null
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Khusus SA
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // State Utama Data Finansial
  const [activeTab, setActiveTab] = useState('On Progress'); // 'On Progress' atau 'done'
  const [submissions, setSubmissions] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(false);

  // State Form Mahasiswa (Requestor) - Pembuatan Awal
  const [newSubmission, setNewSubmission] = useState({
    ormawa: '',
    nama_kegiatan: '',
    pic_pembina: '',
    bph_kegiatan: '',
    cp_bph: '',
    nominal_pengajuan: ''
  });

  // State Form Edit Khusus Mahasiswa saat Perbaikan Per Poin DL
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedRevisionId, setSelectedRevisionId] = useState('');
  const [editSubmission, setEditSubmission] = useState({
    nama_kegiatan: '',
    nominal_pengajuan: ''
  });

  // State Array Kelola UI Catatan Dinamis Kak Dinda (Default status kini 'Need Revision')
  const [revisionList, setRevisionList] = useState([{ id: 'rev_1', deadline: '', catatan: '', status: 'Need Revision' }]);

  useEffect(() => {
    fetchSubmissions();
  }, [activeTab, userRole, isAuthenticated]);

  // Sinkronisasi data saat item dipilih (baik untuk Kak Dinda maupun Mode Edit Mahasiswa)
  useEffect(() => {
    if (selectedItem) {
      if (selectedItem.catatan_revisi) {
        try {
          const parsed = typeof selectedItem.catatan_revisi === 'string' 
            ? JSON.parse(selectedItem.catatan_revisi) 
            : selectedItem.catatan_revisi;
          setRevisionList(Array.isArray(parsed) ? parsed : [{ id: 'rev_' + Date.now(), deadline: selectedItem.deadline_revisi || '', catatan: selectedItem.catatan_revisi, status: 'Need Revision' }]);
        } catch (e) {
          setRevisionList([{ id: 'rev_' + Date.now(), deadline: selectedItem.deadline_revisi || '', catatan: selectedItem.catatan_revisi, status: 'Need Revision' }]);
        }
      } else {
        setRevisionList([{ id: 'rev_' + Date.now(), deadline: '', catatan: '', status: 'Need Revision' }]);
      }

      setEditSubmission({
        nama_kegiatan: selectedItem.nama_kegiatan || '',
        nominal_pengajuan: selectedItem.nominal_pengajuan || ''
      });
    } else {
      setIsEditMode(false);
      setSelectedRevisionId('');
    }
  }, [selectedItem]);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const isCairValue = activeTab === 'done';
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          *,
          submission_logs (
            id,
            note,
            created_at
          )
        `)
        .eq('is_cair', isCairValue)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error) {
      console.error('Error fetching submissions & logs:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSALogin = (e) => {
    e.preventDefault();
    if (passwordInput === 'PCSAYUSI') {
      setIsAuthenticated(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  const handleCreateSubmission = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('submissions').insert([
        {
          ormawa: newSubmission.ormawa,
          nama_kegiatan: newSubmission.nama_kegiatan,
          pic_pembina: newSubmission.pic_pembina,
          bph_kegiatan: newSubmission.bph_kegiatan,
          cp_bph: newSubmission.cp_bph,
          nominal_pengajuan: parseFloat(newSubmission.nominal_pengajuan) || 0,
          status_proposal: 'On Progress',
          is_cair: false,
          catatan_revisi: null
        }
      ]);

      if (error) throw error;
      setNewSubmission({ ormawa: '', nama_kegiatan: '', pic_pembina: '', bph_kegiatan: '', cp_bph: '', nominal_pengajuan: '' });
      fetchSubmissions();
      alert('Pengajuan awal berhasil dikirim!');
    } catch (error) {
      console.error('Gagal menyimpan pengajuan:', error.message);
    }
  };

  // MAHASISWA SUBMIT REVISI -> STATUS BERUBAH MENJADI 'Submited'
  const handleResubmitSubmission = async (e) => {
    e.preventDefault();
    if (!selectedItem || !selectedRevisionId) return;

    try {
      const currentSubmitCount = selectedItem.submission_logs ? selectedItem.submission_logs.length : 1;
      const nextSubmitNumber = currentSubmitCount + 1;

      const updatedRevisions = revisionList.map(rev => {
        if (rev.id === selectedRevisionId) {
          return { ...rev, status: 'Submited' };
        }
        return rev;
      });

      const hasNeedRevision = updatedRevisions.some(r => r.status === 'Need Revision');

      const updates = {
        nama_kegiatan: editSubmission.nama_kegiatan,
        nominal_pengajuan: parseFloat(editSubmission.nominal_pengajuan) || 0,
        status_proposal: hasNeedRevision ? 'Need Revision' : 'On Progress',
        catatan_revisi: JSON.stringify(updatedRevisions)
      };

      const { error: updateError } = await supabase
        .from('submissions')
        .update(updates)
        .eq('id', selectedItem.id);

      if (updateError) throw updateError;

      const targetRev = revisionList.find(r => r.id === selectedRevisionId);
      await supabase
        .from('submission_logs')
        .insert([
          { 
            submission_id: selectedItem.id, 
            note: `Submit Ke-${nextSubmitNumber}: Mahasiswa mengirim berkas untuk perbaikan ("${targetRev?.catatan?.substring(0, 30)}...")` 
          }
        ]);

      alert(`Komponen revisi berhasil di-submit ulang!`);
      setIsEditMode(false);
      setSelectedRevisionId('');
      setSelectedItem(null);
      fetchSubmissions();
    } catch (error) {
      alert('Gagal melakukan submit ulang: ' + error.message);
    }
  };

  const addRevisionRow = () => {
    setRevisionList([...revisionList, { id: 'rev_' + Date.now(), deadline: '', catatan: '', status: 'Need Revision' }]);
  };

  const removeRevisionRow = (index) => {
    const updated = revisionList.filter((_, i) => i !== index);
    setRevisionList(updated.length > 0 ? updated : [{ id: 'rev_' + Date.now(), deadline: '', catatan: '', status: 'Need Revision' }]);
  };

  const handleRevisionChange = (index, field, value) => {
    const updated = [...revisionList];
    updated[index][field] = value;
    setRevisionList(updated);
  };

  // PENGUBAH STATUS POIN INDIVIDU OLEH KAK DINDA (APPROVE / NEED REVISION LAGI)
  const handleIndividualStatusChange = (index, nextStatus) => {
    const updated = [...revisionList];
    updated[index].status = nextStatus;
    setRevisionList(updated);
  };

  // ENGINE DETEKSI SISA WAKTU REAL-TIME UNTUK ELEMENT KOTAK MODAL PANEL
  const getDeadlineAlertClass = (deadlineStr, status) => {
    if (!deadlineStr || status === 'Approved' || status === 'Submited') return 'bg-white border-gray-200';
    
    const today = new Date('2026-07-10'); // Kunci Sinkronisasi Waktu Sekarang
    today.setHours(0,0,0,0);
    const dlDate = new Date(deadlineStr);
    dlDate.setHours(0,0,0,0);
    
    const timeDiff = dlDate.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    if (daysDiff < 0) {
      return 'bg-red-50 border-red-300 text-red-900'; // Terlewat batas waktu (Merah)
    } else if (daysDiff <= 1) {
      return 'bg-amber-50 border-amber-300 text-amber-900'; // H-1 / Hari H (Kuning)
    }
    return 'bg-white border-gray-200';
  };

  // ENGINE DETEKSI SISA WAKTU UNTUK MEWARNAI SELURUH BARIS TABEL (TR) UTAMA
  const getTableRowClass = (catatanRevisiStr, statusProposal) => {
    if (statusProposal !== 'Need Revision' || !catatanRevisiStr) return 'hover:bg-gray-50/50 transition-colors';

    try {
      const revisions = typeof catatanRevisiStr === 'string' 
        ? JSON.parse(catatanRevisiStr) 
        : catatanRevisiStr;

      if (!Array.isArray(revisions) || revisions.length === 0) return 'hover:bg-gray-50/50 transition-colors';

      // Hanya deteksi poin yang belum selesai (bukan Approved dan bukan Submited)
      const activeRevisions = revisions.filter(r => r.status !== 'Approved' && r.status !== 'Submited' && r.deadline);
      if (activeRevisions.length === 0) return 'hover:bg-gray-50/50 transition-colors';

      const today = new Date('2026-07-10');
      today.setHours(0, 0, 0, 0);

      let hasExpired = false;
      let hasUrgent = false;

      activeRevisions.forEach(rev => {
        const dlDate = new Date(rev.deadline);
        dlDate.setHours(0, 0, 0, 0);

        const timeDiff = dlDate.getTime() - today.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

        if (daysDiff < 0) {
          hasExpired = true; // Lewat deadline
        } else if (daysDiff <= 1) {
          hasUrgent = true; // H-1 atau Hari H
        }
      });

      // Prioritas warna merah (lewat DL) meng-override warna kuning (H-1)
      if (hasExpired) {
        return 'bg-red-50 hover:bg-red-100/70 text-red-950 transition-colors border-l-4 border-l-red-500';
      } else if (hasUrgent) {
        return 'bg-amber-50 hover:bg-amber-100/70 text-amber-950 transition-colors border-l-4 border-l-amber-500';
      }
    } catch (e) {
      console.error("Error parsing revision for table row coloration", e);
    }

    return 'hover:bg-gray-50/50 transition-colors';
  };

  // WHATSAPP GENERATOR DENGAN FIX INDENTASI ENTER & NAMA DEPARTEMEN BARU
  const sendWhatsAppNotification = (item, updatedStatus, updatedRevisions) => {
    let phone = item.cp_bph.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) {
      phone = '62' + phone.substring(1);
    }

    const currentSubmitCount = item.submission_logs ? item.submission_logs.length : 1;

    let message = `Halo ${item.bph_kegiatan} (${item.ormawa}),\n\n`;
    message += `Berikut adalah pembaruan status berkas untuk kegiatan *${item.nama_kegiatan}*:\n\n`;
    message += `*Status Terbaru:* _${updatedStatus}_\n`;
    message += `*Peninjauan Tahap:* Berkas Ke-${currentSubmitCount}\n`;

    if (item.nomor_rf) {
      message += `*Nomor RF (CIS):* ${item.nomor_rf}\n`;
    }

    if (updatedStatus === 'Need Revision' && updatedRevisions && updatedRevisions.length > 0) {
      message += `\n*⚠️ DAFTAR CATATAN REVISI & DEADLINE:*\n`;
      updatedRevisions.forEach((rev, idx) => {
        const deskripsiMentah = rev.catatan || 'Tidak ada deskripsi';
        const deskripsiRapi = deskripsiMentah.split('\n').map((line, lIdx) => {
          return lIdx === 0 ? line : `               ${line}`;
        }).join('\n');

        const tenggat = rev.deadline ? new Date(rev.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
        
        message += `${idx + 1}. *Poin Revisi:* ${deskripsiRapi}\n`;
        message += `   *Tenggat Waktu (DL):* ${tenggat}\n`;
        message += `   *Status Poin:* _${rev.status || 'Need Revision'}_\n\n`;
      });
      message += `Silakan buka dashboard website untuk melakukan penyesuaian data dan *Submit Ulang* berkas perbaikan Anda.`;
    } else if (updatedStatus === 'On Progress') {
      message += `\nBerkas pengajuan Anda sedang dalam proses peninjauan kembali oleh Student Affairs.\n`;
    } else if (updatedStatus === 'Diterima') {
      message += `\nSelamat! Berkas kamu telah disetujui. Silakan memantau proses pencairan dana secara berkala.\n`;
    } else if (updatedStatus === 'Reject') {
      message += `\nMohon maaf, berkas pengajuan Anda belum dapat kami setujui.\n`;
    }

    message += `\n\nTerima kasih,\n*Student Affairs Department*`;

    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank'); 
  };

  const handleSaveChanges = async () => {
    if (!selectedItem) return;

    try {
      const processedRevisions = revisionList.map(r => {
        if (selectedItem.status_proposal === 'Need Revision' && r.status === 'Submited') {
          return r; 
        }
        if (selectedItem.status_proposal === 'Need Revision' && r.status !== 'Approved' && r.status !== 'Submited') {
          return { ...r, status: 'Need Revision' };
        }
        return r;
      });

      const validRevisions = processedRevisions.filter(r => r.deadline !== '' || r.catatan !== '');
      const deadlineUtama = validRevisions[0]?.deadline || null;

      const updates = {
        status_proposal: selectedItem.status_proposal,
        nomor_rf: selectedItem.nomor_rf,
        is_cair: selectedItem.is_cair,
        tanggal_cair: selectedItem.is_cair ? new Date().toISOString() : null,
        catatan_revisi: selectedItem.status_proposal === 'Need Revision' ? JSON.stringify(validRevisions) : null,
        deadline_revisi: selectedItem.status_proposal === 'Need Revision' ? deadlineUtama : null
      };

      const { error: updateError } = await supabase
        .from('submissions')
        .update(updates)
        .eq('id', selectedItem.id);

      if (updateError) throw updateError;

      let logNote = `Status berkas diperbarui menjadi [${selectedItem.status_proposal}]`;
      if (selectedItem.status_proposal === 'Need Revision') {
        logNote = `Need Revision: Catatan perbaikan dievaluasi oleh Admin SA`;
      }

      await supabase.from('submission_logs').insert([
        { submission_id: selectedItem.id, note: logNote }
      ]);

      alert('Perubahan berkas berhasil disimpan!');
      sendWhatsAppNotification(selectedItem, selectedItem.status_proposal, validRevisions);
      setSelectedItem(null);
      fetchSubmissions(); 
    } catch (error) {
      alert('Gagal menyimpan perubahan: ' + error.message);
    }
  };

  const formatRupiah = (num) => {
    if (!num) return 'Rp 0';
    return 'Rp ' + Number(num).toLocaleString('id-ID');
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#334155] font-sans antialiased">
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">SA</div>
          <h1 className="text-lg font-semibold tracking-tight text-gray-900">Finance Tracker</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-md">Role: {userRole === 'sa' ? 'Kak Dinda (SA)' : 'Mahasiswa'}</span>
          <button onClick={() => { setUserRole(null); setIsAuthenticated(false); setPasswordInput(''); }} className="text-xs text-red-500 hover:text-red-700 font-medium">Kelola Akses</button>
        </div>
      </header>

      {/* PORTAL GATEWAY SELECTION */}
      {userRole === null ? (
        <div className="min-h-[80vh] flex flex-col justify-center items-center p-4">
          <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-xl max-w-md w-full text-center space-y-4">
            <h2 className="text-xl font-bold text-gray-900">SA Finance Gateway</h2>
            <div className="grid grid-cols-1 gap-2">
              <button onClick={() => setUserRole('request')} className="py-3 border rounded-xl text-sm font-medium hover:bg-indigo-50/40 hover:border-indigo-600 transition-all">Mahasiswa (Requestor)</button>
              <button onClick={() => setUserRole('sa')} className="py-3 border rounded-xl text-sm font-medium hover:bg-indigo-50/40 hover:border-indigo-600 transition-all">Kak Dinda (Admin SA)</button>
            </div>
          </div>
        </div>
      ) : userRole === 'sa' && !isAuthenticated ? (
        <div className="min-h-[80vh] flex flex-col justify-center items-center p-4">
          <form onSubmit={handleSALogin} className="bg-white p-6 rounded-xl border shadow-md space-y-3 max-w-sm w-full">
            <h3 className="text-sm font-bold">Otentikasi Token SA</h3>
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full border p-2 rounded text-center tracking-widest" placeholder="••••••••" />
            <button type="submit" className="w-full py-2 bg-indigo-600 text-white text-xs font-bold rounded">Validasi</button>
          </form>
        </div>
      ) : (
        <main className="max-w-7xl mx-auto px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {userRole === 'request' && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs space-y-4 h-fit">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">Buat Pengajuan Baru</h3>
              <form onSubmit={handleCreateSubmission} className="space-y-3 text-sm">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Nama ORMAWA</label>
                  <input required type="text" value={newSubmission.ormawa} onChange={(e) => setNewSubmission({...newSubmission, ormawa: e.target.value})} className="w-full border rounded-lg p-2 text-xs" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Nama Kegiatan</label>
                  <input required type="text" value={newSubmission.nama_kegiatan} onChange={(e) => setNewSubmission({...newSubmission, nama_kegiatan: e.target.value})} className="w-full border rounded-lg p-2 text-xs" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">BPH Pengaju</label>
                    <input required type="text" value={newSubmission.bph_kegiatan} onChange={(e) => setNewSubmission({...newSubmission, bph_kegiatan: e.target.value})} className="w-full border rounded-lg p-2 text-xs" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">No. WhatsApp CP</label>
                    <input required type="text" value={newSubmission.cp_bph} onChange={(e) => setNewSubmission({...newSubmission, cp_bph: e.target.value})} className="w-full border rounded-lg p-2 text-xs" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Nominal Dana</label>
                  <input required type="number" value={newSubmission.nominal_pengajuan} onChange={(e) => setNewSubmission({...newSubmission, nominal_pengajuan: e.target.value})} className="w-full border rounded-lg p-2 text-xs" />
                </div>
                <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white font-medium text-xs rounded-lg shadow-xs">Kirim Berkas</button>
              </form>
            </div>
          )}

          <div className={`${userRole === 'request' ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-4`}>
            <div className="flex border-b border-gray-200 mb-2 gap-2">
              <button onClick={() => setActiveTab('On Progress')} className={`px-5 py-2 font-medium text-sm border-b-2 ${activeTab === 'On Progress' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>On Progress</button>
              <button onClick={() => setActiveTab('done')} className={`px-5 py-2 font-medium text-sm border-b-2 ${activeTab === 'done' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>Done Pencairan</button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
              {loading ? (
                <div className="p-12 text-center text-sm text-gray-400">Loading...</div>
              ) : submissions.length === 0 ? (
                <div className="p-12 text-center text-sm text-gray-400">Tidak ada pengajuan berkas.</div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F8F9FA] border-b border-gray-200 font-semibold text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3">ORMAWA</th>
                      <th className="px-4 py-3">Nama Kegiatan</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Nominal</th>
                      <th className="px-4 py-3">Nomor RF (CIS)</th>
                      <th className="px-4 py-3 text-right">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {submissions.map((item) => {
                      const submitKe = item.submission_logs ? item.submission_logs.length : 1;
                      // Integrasi Deteksi Blok Warna Dinamis untuk Baris Tabel (TR)
                      const tableRowColorClass = getTableRowClass(item.catatan_revisi, item.status_proposal);

                      return (
                        <tr key={item.id} className={tableRowColorClass}>
                          <td className="px-4 py-3.5 font-medium">{item.ormawa}<span className="block text-[10px] text-gray-400 font-normal mt-0.5">Submit #{submitKe}</span></td>
                          <td className="px-4 py-3.5 text-gray-600">{item.nama_kegiatan}</td>
                          <td className="px-4 py-3.5">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              item.status_proposal === 'Diterima' ? 'bg-[#E6F4EA] text-[#137333]' : 
                              item.status_proposal === 'Need Revision' ? 'bg-[#FEF7E0] text-[#B06000]' : 'bg-[#E8F0FE] text-[#1A73E8]'
                            }`}>{item.status_proposal}</span>
                          </td>
                          <td className="px-4 py-3.5 font-mono">{formatRupiah(item.nominal_pengajuan)}</td>
                          <td className="px-4 py-3.5 font-mono text-gray-500">{item.nomor_rf || '—'}</td>
                          <td className="px-4 py-3.5 text-right space-x-2">
                            <button onClick={() => setSelectedItem(item)} className="text-indigo-600 font-bold bg-indigo-50 px-2 py-1 rounded">Detail</button>
                            {userRole === 'sa' && (
                              <button onClick={() => {
                                let list = []; try { if(item.catatan_revisi) list = JSON.parse(item.catatan_revisi); } catch(e){}
                                sendWhatsAppNotification(item, item.status_proposal, list);
                              }} className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded">💬 WA</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </main>
      )}

      {/* DYNAMIC PANEL SLIDE-OVER RIGHT */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-gray-900/20 backdrop-blur-xs" onClick={() => { setSelectedItem(null); setIsEditMode(false); }} />
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col p-6 space-y-5">
            <div>
              <span className="text-xs font-bold text-gray-400 uppercase">{selectedItem.ormawa}</span>
              <h3 className="text-base font-semibold text-gray-900">{selectedItem.nama_kegiatan}</h3>
              <p className="text-[11px] text-gray-400">PIC: {selectedItem.bph_kegiatan}</p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 text-xs">
              {/* VIEW KAK DINDA */}
              {userRole === 'sa' ? (
                <>
                  <div className="space-y-1.5">
                    <label className="font-bold text-gray-500 uppercase block">Ubah Status Berkas</label>
                    <div className="flex flex-wrap gap-2">
                      {['On Progress', 'Diterima', 'Need Revision', 'Reject'].map((st) => (
                        <button key={st} onClick={() => setSelectedItem({...selectedItem, status_proposal: st})} className={`flex-1 min-w-[100px] py-2 font-medium rounded-lg border text-center text-xs ${selectedItem.status_proposal === st ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold' : 'border-gray-200 text-gray-600'}`}>{st}</button>
                      ))}
                    </div>
                  </div>

                  {selectedItem.status_proposal === 'Need Revision' && (
                    <div className="space-y-3 bg-slate-50 p-4 rounded-xl border">
                      <label className="font-bold text-gray-700 uppercase block">Daftar Poin Catatan Revisi & Deadline</label>
                      {revisionList.map((rev, index) => (
                        <div key={rev.id || index} className={`p-3 border rounded-lg space-y-2 relative transition-all ${getDeadlineAlertClass(rev.deadline, rev.status)}`}>
                          <div className="flex justify-between items-center">
                            <div className="w-1/2">
                              <label className="text-[10px] text-gray-400 block mb-0.5">Tenggat Waktu (Deadline)</label>
                              <input type="date" value={rev.deadline || ''} onChange={(e) => handleRevisionChange(index, 'deadline', e.target.value)} className="w-full border rounded p-1 text-xs bg-white text-gray-800" />
                            </div>
                            
                            {/* KONTROL INTERAKTIF KAK DINDA UNTUK EVALUASI POIN REVISI */}
                            <div className="flex flex-col items-end gap-1">
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${rev.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : rev.status === 'Submited' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>{rev.status || 'Need Revision'}</span>
                              {rev.status === 'Submited' && (
                                <div className="flex gap-1 mt-1">
                                  <button type="button" onClick={() => handleIndividualStatusChange(index, 'Approved')} className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px] font-bold">Approve</button>
                                  <button type="button" onClick={() => handleIndividualStatusChange(index, 'Need Revision')} className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-bold">Reject</button>
                                </div>
                              )}
                            </div>

                            {revisionList.length > 1 && (
                              <button onClick={() => removeRevisionRow(index)} className="text-red-500 font-bold ml-2">&times;</button>
                            )}
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400 block mb-0.5">Deskripsi Bagian Yang Direvisi (Mendukung Enter)</label>
                            <textarea rows="3" value={rev.catatan || ''} onChange={(e) => handleRevisionChange(index, 'catatan', e.target.value)} className="w-full border rounded p-1.5 text-xs bg-white text-gray-800" placeholder="Tulis catatan di sini..." />
                          </div>
                        </div>
                      ))}
                      <button type="button" onClick={addRevisionRow} className="w-full py-2 bg-indigo-50 text-indigo-700 font-semibold rounded-lg text-xs">+ Tambah Poin Catatan/DL Baru</button>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="font-bold text-gray-500 uppercase block">Nomor RF (CIS)</label>
                    <input type="text" value={selectedItem.nomor_rf || ''} onChange={(e) => setSelectedItem({...selectedItem, nomor_rf: e.target.value})} className="w-full border p-2 text-xs font-mono" placeholder="UC/SA/..." />
                  </div>

                  <div className="flex items-center gap-2 bg-emerald-50 p-2 rounded border border-emerald-100">
                    <input type="checkbox" id="is_cair" checked={selectedItem.is_cair || false} onChange={(e) => setSelectedItem({...selectedItem, is_cair: e.target.checked})} />
                    <label htmlFor="is_cair" className="text-emerald-800 font-medium">Sudah Dicairkan ke Mahasiswa</label>
                  </div>
                </>
              ) : (
                /* VIEW MAHASISWA */
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-xl border space-y-3">
                    <div>
                      <span className="text-gray-400 block uppercase font-bold text-[10px]">Status Proposal Utama</span>
                      <span className="text-xs font-bold text-gray-800">{selectedItem.status_proposal}</span>
                    </div>

                    {selectedItem.status_proposal === 'Need Revision' && (
                      <div className="mt-2 space-y-3">
                        <span className="text-slate-700 block uppercase font-bold text-[10px]">📌 Daftar Instruksi Komponen Perbaikan:</span>
                        <div className="space-y-2.5">
                          {revisionList.map((rev) => (
                            <div key={rev.id} className={`p-3 border rounded-lg shadow-xs flex flex-col space-y-2 ${getDeadlineAlertClass(rev.deadline, rev.status)}`}>
                              <div className="flex justify-between items-center border-b pb-1">
                                <span className="font-bold text-gray-500 text-[10px]">DL: {rev.deadline ? new Date(rev.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</span>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${rev.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : rev.status === 'Submited' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>{rev.status || 'Need Revision'}</span>
                              </div>
                              <p className="whitespace-pre-line text-gray-800 font-medium">{rev.catatan || 'Ada komponen revisi.'}</p>
                              
                              {rev.status === 'Need Revision' && !isEditMode && (
                                <button type="button" onClick={() => { setSelectedRevisionId(rev.id); setIsEditMode(true); }} className="mt-1 self-end py-1 px-3 bg-indigo-600 text-white text-[11px] font-bold rounded-md">
                                  Submit Ulang DL Ini
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        {isEditMode && (
                          <form onSubmit={handleResubmitSubmission} className="bg-white border border-indigo-200 rounded-xl p-4 space-y-3 mt-4">
                            <div className="flex justify-between items-center border-b pb-1">
                              <span className="font-bold text-indigo-950">Form Submit Ulang Komponen</span>
                              <button type="button" onClick={() => { setIsEditMode(false); setSelectedRevisionId(''); }} className="text-red-500 text-xs font-bold">Batal</button>
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400 block mb-1">Nama Kegiatan</label>
                              <input required type="text" value={editSubmission.nama_kegiatan} onChange={(e) => setEditSubmission({...editSubmission, nama_kegiatan: e.target.value})} className="w-full border p-1.5 text-xs rounded" />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400 block mb-1">Nominal Dana Baru</label>
                              <input required type="number" value={editSubmission.nominal_pengajuan} onChange={(e) => setEditSubmission({...editSubmission, nominal_pengajuan: e.target.value})} className="w-full border p-1.5 text-xs rounded" />
                            </div>
                            <button type="submit" className="w-full py-2 bg-emerald-600 text-white font-bold text-xs rounded-lg">🚀 Kirim Berkas Perbaikan</button>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-100 flex gap-2">
              <button onClick={() => { setSelectedItem(null); setIsEditMode(false); setSelectedRevisionId(''); }} className="flex-1 py-2.5 border rounded-xl hover:bg-gray-100 text-xs text-center">Tutup</button>
              {userRole === 'sa' && (
                <button onClick={handleSaveChanges} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-medium">Simpan & Kirim WA</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}