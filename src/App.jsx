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

  // State Form Edit Khusus Mahasiswa saat Revisi/Submit Ulang
  const [isEditMode, setIsEditMode] = useState(false);
  const [editSubmission, setEditSubmission] = useState({
    nama_kegiatan: '',
    nominal_pengajuan: ''
  });

  // State Array untuk Kelola UI Catatan Dinamis Kak Dinda
  // Menyimpan objek: { deadline: '', catatan: '', status: 'Need Revision' | 'Submitted' }
  const [revisionList, setRevisionList] = useState([{ deadline: '', catatan: '', status: 'Need Revision' }]);

  useEffect(() => {
    if (userRole === 'sa' && isAuthenticated) {
      fetchSubmissions();
    } else if (userRole === 'request') {
      fetchSubmissions();
    }
  }, [activeTab, userRole, isAuthenticated]);

  // Sinkronisasi data saat item dipilih (baik untuk Kak Dinda maupun Mode Edit Mahasiswa)
  useEffect(() => {
    if (selectedItem) {
      // Set data untuk Kak Dinda dari array struktur JSON yang disimpan di DB
      if (selectedItem.catatan_revisi) {
        try {
          // Mencoba parsing data jika disimpan sebagai format array string JSON
          const parsed = JSON.parse(selectedItem.catatan_revisi);
          if (Array.isArray(parsed)) {
            setRevisionList(parsed);
          } else {
            setRevisionList([{ deadline: selectedItem.deadline_revisi || '', catatan: selectedItem.catatan_revisi, status: 'Need Revision' }]);
          }
        } catch (e) {
          setRevisionList([{ deadline: selectedItem.deadline_revisi || '', catatan: selectedItem.catatan_revisi, status: 'Need Revision' }]);
        }
      } else {
        setRevisionList([{ deadline: '', catatan: '', status: 'Need Revision' }]);
      }

      // Set data awal untuk form edit mahasiswa
      setEditSubmission({
        nama_kegiatan: selectedItem.nama_kegiatan || '',
        nominal_pengajuan: selectedItem.nominal_pengajuan || ''
      });
    } else {
      setIsEditMode(false);
    }
  }, [selectedItem]);

  // Fetch data dengan join relasi tabel riwayat submission_logs
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

  // 1. INPUT BERKAS AWAL OLEH MAHASISWA
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
          is_cair: false
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

  // HELPER UNTUK CEK REVISI TERPILIH YANG AKAN DI-SUBMIT MAHASISWA
  const [selectedRevisionIndex, setSelectedRevisionIndex] = useState(0);

  // 2. FITUR EDIT & SUBMIT ULANG (RESUBMIT) OLEH MAHASISWA SETELAH REVISI Selesai
  const handleResubmitSubmission = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;

    try {
      const currentSubmitCount = selectedItem.submission_logs ? selectedItem.submission_logs.length : 1;
      const nextSubmitNumber = currentSubmitCount + 1;

      // Update item revisi tertentu yang dipilih mahasiswa menjadi 'Submitted'
      let updatedRevisions = [...revisionList];
      if (updatedRevisions[selectedRevisionIndex]) {
        updatedRevisions[selectedRevisionIndex].status = 'Submitted';
        updatedRevisions[selectedRevisionIndex].submitted_at = new Date().toISOString();
      }

      // Cek apakah semua revisi sudah di-submit oleh mahasiswa
      const allSubmitted = updatedRevisions.every(rev => rev.status === 'Submitted');
      
      // Jika semua sudah di-submit, status utama menjadi 'On Progress'. Jika belum, tetap 'Need Revision'.
      const nextGlobalStatus = allSubmitted ? 'On Progress' : 'Need Revision';

      const updates = {
        nama_kegiatan: editSubmission.nama_kegiatan,
        nominal_pengajuan: parseFloat(editSubmission.nominal_pengajuan) || 0,
        status_proposal: nextGlobalStatus,
        catatan_revisi: JSON.stringify(updatedRevisions), // Simpan array riwayat status revisi lengkap
        deadline_revisi: updatedRevisions.find(r => r.status === 'Need Revision')?.deadline || updatedRevisions[0]?.deadline
      };

      const { error: updateError } = await supabase
        .from('submissions')
        .update(updates)
        .eq('id', selectedItem.id);

      if (updateError) throw updateError;

      // Catat log pengerjaan submit ulang ke tabel submission_logs dengan detail info waktu & poin revisinya
      const poinInfo = updatedRevisions[selectedRevisionIndex]?.catatan || '';
      const { error: logError } = await supabase
        .from('submission_logs')
        .insert([
          { 
            submission_id: selectedItem.id, 
            note: `Submit Perbaikan Ke-${nextSubmitNumber}: Poin "${poinInfo}" telah direvisi dan disubmit kembali oleh Mahasiswa.` 
          }
        ]);

      if (logError) throw logError;

      alert(`Berkas poin revisi berhasil disubmit ulang! Status saat ini: ${nextGlobalStatus}`);
      setIsEditMode(false);
      setSelectedItem(null);
      fetchSubmissions();
    } catch (error) {
      alert('Gagal melakukan submit ulang: ' + error.message);
    }
  };

  const addRevisionRow = () => {
    setRevisionList([...revisionList, { deadline: '', catatan: '', status: 'Need Revision' }]);
  };

  const removeRevisionRow = (index) => {
    const updated = revisionList.filter((_, i) => i !== index);
    setRevisionList(updated.length > 0 ? updated : [{ deadline: '', catatan: '', status: 'Need Revision' }]);
  };

  const handleRevisionChange = (index, field, value) => {
    const updated = [...revisionList];
    updated[index][field] = value;
    setRevisionList(updated);
  };

  // 3. TRIGGER AUTOMATION WHATSAPP DENGAN URUTAN SUBMIT
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
        const deskripsi = rev.catatan || 'Tidak ada deskripsi';
        const tenggat = rev.deadline ? new Date(rev.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
        const statusRev = rev.status === 'Submitted' ? '✅ Sudah Perbaikan' : '⏳ Belum Direvisi';
        message += `${idx + 1}. *Poin Revisi:*\n   ${deskripsi}\n   *Tenggat Waktu (DL):* ${tenggat}\n   *Status Poin:* ${statusRev}\n\n`;
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

  // 4. SIMPAN PERUBAHAN & UPDATE LOG STATUS OLEH KAK DINDA (SA)
  const handleSaveChanges = async () => {
    if (!selectedItem) return;

    try {
      // Memastikan baris baru yang dibuat Kak Dinda memiliki status default 'Need Revision' jika belum disubmit ulang
      const validRevisions = revisionList.map(r => ({
        deadline: r.deadline || '',
        catatan: r.catatan || '',
        status: r.status || 'Need Revision',
        submitted_at: r.submitted_at || null,
        resubmitted_at: r.resubmitted_at || null
      })).filter(r => r.deadline !== '' || r.catatan !== '');

      const catatanGabungan = validRevisions.map(r => `[${r.status}] ${r.catatan}`).join('; ');
      const deadlineUtama = validRevisions.find(r => r.status === 'Need Revision')?.deadline || validRevisions[0]?.deadline || null;

      // Jika Kak Dinda mengubah status utama ke "Need Revision" (revisi ulang), maka semua poin/status yang sebelumnya "Submitted" ikut diturunkan kembali menjadi "Need Revision"
      let finalRevisions = [...validRevisions];
      let statusProposalFinal = selectedItem.status_proposal;
      
      if (selectedItem.status_proposal === 'Need Revision') {
        finalRevisions = validRevisions.map(r => {
          if (r.status === 'Submitted') {
            return {
              ...r,
              status: 'Need Revision',
              resubmitted_at: new Date().toISOString() // Kapan disubmit ulang/disuruh revisi ulang
            };
          }
          return r;
        });
      }

      const updates = {
        status_proposal: statusProposalFinal,
        nomor_rf: selectedItem.nomor_rf,
        is_cair: selectedItem.is_cair,
        tanggal_cair: selectedItem.is_cair ? new Date().toISOString() : null,
        catatan_revisi: JSON.stringify(finalRevisions),
        deadline_revisi: deadlineUtama
      };

      const { error: updateError } = await supabase
        .from('submissions')
        .update(updates)
        .eq('id', selectedItem.id);

      if (updateError) throw updateError;

      // Catat log riwayat peninjauan status
      let logNote = `Status berkas diperbarui menjadi [${statusProposalFinal}]`;
      if (statusProposalFinal === 'Need Revision') {
        logNote = `Need Revision/Revisi Ulang: Catatan dikirim ke mahasiswa oleh Kak Dinda.`;
      } else if (selectedItem.is_cair) {
        logNote = `Done: Dana berhasil dicairkan`;
      }

      await supabase.from('submission_logs').insert([
        { submission_id: selectedItem.id, note: logNote }
      ]);

      alert('Data dan Log berhasil disimpan!');
      sendWhatsAppNotification(selectedItem, statusProposalFinal, finalRevisions);
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

  // HELPER UNTUK CEK BG WARNA BLOCK KOLOM BERDASARKAN DEADLINE (H-1 KUNING, LEWAT RED)
  const getDeadlineRowStyle = (deadlineStr, statusProposal) => {
    if (!deadlineStr || statusProposal !== 'Need Revision') return '';
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const dlDate = new Date(deadlineStr);
    dlDate.setHours(0,0,0,0);
    
    const diffTime = dlDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return 'bg-red-100 border-l-4 border-red-500'; // Lewat deadline = Merah
    } else if (diffDays <= 1) {
      return 'bg-yellow-100 border-l-4 border-yellow-500'; // H-1 atau Hari H = Kuning
    }
    return '';
  };

  // ==================== TAMPILAN PINTU GERBANG (LOGIN AWAL) ====================
  if (userRole === null) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-center items-center p-4">
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-xl max-w-md w-full text-center space-y-6">
          <div>
            <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg mx-auto shadow-md">SA</div>
            <h2 className="text-xl font-bold text-gray-900 mt-4">SA Finance Gateway</h2>
            <p className="text-xs text-gray-400 mt-1">Silakan pilih akses gerbang Anda untuk melanjutkan</p>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <button onClick={() => setUserRole('request')} className="py-3 border-2 border-gray-100 hover:border-indigo-600 rounded-xl font-medium text-sm text-gray-700 hover:text-indigo-600 transition-all bg-gray-50/50 hover:bg-indigo-50/20 text-left px-5 flex items-center justify-between">
              <span>Masuk sebagai <strong>Mahasiswa</strong></span>
              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-md font-normal">Requestor</span>
            </button>
            <button onClick={() => setUserRole('sa')} className="py-3 border-2 border-gray-100 hover:border-indigo-600 rounded-xl font-medium text-sm text-gray-700 hover:text-indigo-600 transition-all bg-gray-50/50 hover:bg-indigo-50/20 text-left px-5 flex items-center justify-between">
              <span>Masuk sebagai <strong>Kak Dinda</strong></span>
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md font-bold">Admin SA</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== SCREEN VALIDASI PASSWORD KAK DINDA ====================
  if (userRole === 'sa' && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-center items-center p-4">
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-xl max-w-sm w-full space-y-4">
          <button onClick={() => setUserRole(null)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">&larr; Kembali</button>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Otentikasi Internal SA</h3>
            <p className="text-xs text-gray-400 mt-0.5">Masukkan kunci akses finansial Student Affairs</p>
          </div>
          <form onSubmit={handleSALogin} className="space-y-3">
            <input autoFocus type="password" placeholder="••••••••" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-indigo-600 font-mono tracking-widest text-center" />
            {passwordError && <p className="text-[11px] text-red-500 text-center font-medium">Kunci akses salah. Periksa kembali token Anda.</p>}
            <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white font-medium text-sm rounded-xl hover:bg-indigo-700 transition-colors shadow-xs">Validasi Akses</button>
          </form>
        </div>
      </div>
    );
  }

  // ==================== TAMPILAN DASHBOARD UTAMA ====================
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

      <main className="max-w-7xl mx-auto px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {userRole === 'request' && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs space-y-4 h-fit">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">Buat Pengajuan Baru</h3>
            <form onSubmit={handleCreateSubmission} className="space-y-3 text-sm">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Nama ORMAWA</label>
                <input required type="text" placeholder="Contoh: UC Choir" value={newSubmission.ormawa} onChange={(e) => setNewSubmission({...newSubmission, ormawa: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2 text-xs" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Nama Kegiatan</label>
                <input required type="text" placeholder="Contoh: Konser Tahunan" value={newSubmission.nama_kegiatan} onChange={(e) => setNewSubmission({...newSubmission, nama_kegiatan: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2 text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">PIC Pembina</label>
                  <input required type="text" placeholder="Nama Pembina" value={newSubmission.pic_pembina} onChange={(e) => setNewSubmission({...newSubmission, pic_pembina: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2 text-xs" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">BPH Pengaju</label>
                  <input required type="text" placeholder="Nama Lengkap" value={newSubmission.bph_kegiatan} onChange={(e) => setNewSubmission({...newSubmission, bph_kegiatan: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2 text-xs" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">No. WhatsApp CP BPH</label>
                <input required type="text" placeholder="Contoh: 08123456789" value={newSubmission.cp_bph} onChange={(e) => setNewSubmission({...newSubmission, cp_bph: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2 text-xs" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Nominal Dana</label>
                <input required type="number" placeholder="Rp" value={newSubmission.nominal_pengajuan} onChange={(e) => setNewSubmission({...newSubmission, nominal_pengajuan: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2 text-xs" />
              </div>
              <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white font-medium text-xs rounded-lg hover:bg-indigo-700 transition-colors shadow-xs">Kirim Berkas</button>
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
              <div className="p-12 text-center text-sm text-gray-400">Menyeimbangkan database...</div>
            ) : submissions.length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-400">Tidak ada pengajuan berkas di area ini.</div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F8F9FA] border-b border-gray-200 font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3">ORMAWA</th>
                    <th className="px-4 py-3">Nama Kegiatan</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Nominal</th>
                    <th className="px-4 py-3">Deadline Utama</th>
                    <th className="px-4 py-3 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {submissions.map((item) => {
                    const submitKe = item.submission_logs ? item.submission_logs.length : 1;
                    const styleWarnaDeadline = getDeadlineRowStyle(item.deadline_revisi, item.status_proposal);
                    return (
                      <tr key={item.id} className={`hover:bg-gray-50/50 ${styleWarnaDeadline}`}>
                        <td className="px-4 py-3.5 font-medium text-gray-900">
                          {item.ormawa}
                          <span className="block text-[10px] text-gray-400 font-normal mt-0.5">Aktivitas #{submitKe}</span>
                        </td>
                        <td className="px-4 py-3.5 text-gray-600">{item.nama_kegiatan}</td>
                        <td className="px-4 py-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            item.status_proposal === 'Diterima' ? 'bg-[#E6F4EA] text-[#137333]' : 
                            item.status_proposal === 'Need Revision' ? 'bg-[#FEF7E0] text-[#B06000]' : 
                            item.status_proposal === 'On Progress' ? 'bg-[#E8F0FE] text-[#1A73E8]' : 'bg-[#FCE8E6] text-[#C5221F]'
                          }`}>
                            {item.status_proposal}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono">{formatRupiah(item.nominal_pengajuan)}</td>
                        <td className="px-4 py-3.5 font-mono text-gray-500">
                          {item.deadline_revisi ? new Date(item.deadline_revisi).toLocaleDateString('id-ID', {day:'numeric', month:'short'}) : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-right space-x-1.5">
                          <button onClick={() => setSelectedItem(item)} className="text-indigo-600 hover:text-indigo-900 font-bold bg-indigo-50 px-2 py-1 rounded">Detail</button>
                          
                          {/* TOMBOL WA HANYA MUNCUL JIKA USER ADALAH KAK DINDA (SA) */}
                          {userRole === 'sa' && (
                            <button onClick={() => sendWhatsAppNotification(item, item.status_proposal, revisionList)} className="text-emerald-600 hover:text-emerald-900 font-bold bg-emerald-50 px-2 py-1 rounded">💬 WA</button>
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

      {/* PANEL SLIDE-OVER KANAN (Bisa Diakses Mahasiswa & Kak Dinda) */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-gray-900/20 backdrop-blur-xs" onClick={() => { setSelectedItem(null); setIsEditMode(false); }} />
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-gray-200 p-6 space-y-5">
            <div>
              <span className="text-xs font-bold text-gray-400 uppercase">{selectedItem.ormawa}</span>
              <h3 className="text-base font-semibold text-gray-900">{selectedItem.nama_kegiatan}</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">PIC: {selectedItem.bph_kegiatan} ({selectedItem.cp_bph})</p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 text-xs">
              {/* JIKA USER ADALAH KAK DINDA (SA) -> VIEW EDITABLE STATUS */}
              {userRole === 'sa' ? (
                <>
                  <div className="space-y-1.5">
                    <label className="font-bold text-gray-500 uppercase block">Ubah Status Berkas Utama</label>
                    <div className="flex flex-wrap gap-2">
                      {['On Progress', 'Diterima', 'Need Revision', 'Reject'].map((st) => (
                        <button key={st} onClick={() => setSelectedItem({...selectedItem, status_proposal: st})} className={`flex-1 min-w-[100px] py-2 font-medium rounded-lg border text-center transition-all ${selectedItem.status_proposal === st ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold shadow-xs' : 'border-gray-200 text-gray-600'}`}>{st}</button>
                      ))}
                    </div>
                  </div>

                  {selectedItem.status_proposal === 'Need Revision' && (
                    <div className="space-y-3 bg-amber-50/40 p-4 rounded-xl border border-amber-100">
                      <label className="font-bold text-amber-800 uppercase block">Daftar Multi Poin Catatan Revisi</label>
                      {revisionList.map((rev, index) => (
                        <div key={index} className="p-3 bg-white border border-amber-200 rounded-lg space-y-2 relative shadow-xs">
                          <div className="flex justify-between items-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${rev.status === 'Submitted' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                              Status: {rev.status || 'Need Revision'}
                            </span>
                            {revisionList.length > 1 && (
                              <button onClick={() => removeRevisionRow(index)} className="text-red-500 hover:text-red-700 font-bold">&times;</button>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 gap-2">
                            <div>
                              <label className="text-[10px] text-gray-400 block mb-0.5">Tenggat Waktu (Deadline)</label>
                              <input type="date" value={rev.deadline || ''} onChange={(e) => handleRevisionChange(index, 'deadline', e.target.value)} className="w-full border border-gray-200 rounded-md p-1.5 text-xs" />
                            </div>
                            
                            {/* RIWAYAT LOG KECIL PER POIN REVISI */}
                            <div className="text-[10px] text-gray-500 space-y-0.5">
                              {rev.submitted_at && <p>📥 Disubmit: {new Date(rev.submitted_at).toLocaleString('id-ID')}</p>}
                              {rev.resubmitted_at && <p>🔄 Disuruh Revisi Ulang: {new Date(rev.resubmitted_at).toLocaleString('id-ID')}</p>}
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400 block mb-0.5">Deskripsi Bagian Yang Direvisi</label>
                            <textarea rows="2" placeholder="Contoh: Rincian nota konsumsi di lampiran 3 belum dicap basah." value={rev.catatan || ''} onChange={(e) => handleRevisionChange(index, 'catatan', e.target.value)} className="w-full border border-gray-200 rounded-md p-1.5 text-xs focus:outline-hidden" />
                          </div>
                        </div>
                      ))}
                      <button type="button" onClick={addRevisionRow} className="w-full py-2 bg-amber-600/10 hover:bg-amber-600/20 text-amber-800 font-semibold text-xs rounded-lg transition-colors">+ Tambah Poin Catatan Baru</button>
                    </div>
                  )}

                  <div className="space-y-1 pt-2 border-t border-gray-100">
                    <label className="font-bold text-gray-500 uppercase block">Nomor RF (CIS)</label>
                    <input type="text" value={selectedItem.nomor_rf || ''} onChange={(e) => setSelectedItem({...selectedItem, nomor_rf: e.target.value})} placeholder="Contoh: UC/SA/2025-2026/00390" className="w-full font-mono border border-gray-200 rounded-lg p-2 text-xs" />
                  </div>

                  <div className="flex items-start gap-3 bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                    <input type="checkbox" id="is_cair" checked={selectedItem.is_cair || false} onChange={(e) => setSelectedItem({...selectedItem, is_cair: e.target.checked})} className="mt-0.5" />
                    <label htmlFor="is_cair" className="text-[11px] text-emerald-800">
                      <strong>Sudah Dicairkan ke Mahasiswa</strong>
                      <span className="block text-gray-400 mt-0.5">Mencentang ini otomatis memindahkan data ke tab "Done Pencairan"</span>
                    </label>
                  </div>
                </>
              ) : (
                /* JIKA USER ADALAH MAHASISWA -> VIEW DATA / FORM EDIT SUBMIT ULANG */
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                    <div>
                      <span className="text-gray-400 block uppercase font-bold text-[10px]">Status Proposal Utama</span>
                      <span className="text-xs font-bold text-gray-800">{selectedItem.status_proposal}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block uppercase font-bold text-[10px]">Nominal Dana Saat Ini</span>
                      <span className="text-xs font-mono font-bold text-gray-800">{formatRupiah(selectedItem.nominal_pengajuan)}</span>
                    </div>

                    {selectedItem.status_proposal === 'Need Revision' && (
                      <div className="mt-2 pt-3 border-t border-gray-200 space-y-3">
                        <span className="text-amber-800 block uppercase font-bold text-[10px] tracking-wide">⚠️ Pilih Poin Instruksi Yang Mau Diperbaiki Terlebih Dahulu:</span>
                        
                        {/* LIST DAFTAR MANDIRI PILIHAN REVISI */}
                        <div className="space-y-2">
                          {revisionList.map((rev, idx) => (
                            <div 
                              key={idx} 
                              onClick={() => { if(rev.status !== 'Submitted') setSelectedRevisionIndex(idx); }}
                              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                selectedRevisionIndex === idx && rev.status !== 'Submitted' ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-200 bg-white'
                              } ${rev.status === 'Submitted' ? 'opacity-60 bg-green-50' : ''}`}
                            >
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-[10px] text-indigo-600">Poin #{idx + 1}</span>
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${rev.status === 'Submitted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {rev.status === 'Submitted' ? '✅ Submitted' : '⏳ Need Revision'}
                                </span>
                              </div>
                              <p className="font-medium text-gray-800">📌 {rev.catatan || 'Ada perbaikan berkas'}</p>
                              <p className="text-[10px] text-gray-500 mt-1 font-bold">⏳ DL: {rev.deadline ? new Date(rev.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</p>
                            </div>
                          ))}
                        </div>
                        
                        {/* TOGGLE TOMBOL EDIT BERKAS MAHASISWA */}
                        {!isEditMode ? (
                          <button 
                            onClick={() => setIsEditMode(true)} 
                            disabled={revisionList[selectedRevisionIndex]?.status === 'Submitted'}
                            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors text-center disabled:opacity-50"
                          >
                            ✏️ Edit Data & Siapkan Submit Poin Pilihan (#{selectedRevisionIndex + 1})
                          </button>
                        ) : (
                          /* FORMULIR EDIT JIKA MODE EDIT AKTIF */
                          <form onSubmit={handleResubmitSubmission} className="bg-white border border-amber-200 rounded-xl p-4 space-y-3 text-left">
                            <div className="flex justify-between items-center border-b pb-1.5">
                              <span className="font-bold text-gray-700">Form Perbaikan Poin #{selectedRevisionIndex + 1}</span>
                              <button type="button" onClick={() => setIsEditMode(false)} className="text-red-500 text-xs font-bold">Batal</button>
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400 block mb-1">Nama Kegiatan (Terbaru)</label>
                              <input required type="text" value={editSubmission.nama_kegiatan} onChange={(e) => setEditSubmission({...editSubmission, nama_kegiatan: e.target.value})} className="w-full border p-1.5 text-xs rounded" />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400 block mb-1">Nominal Pengajuan Dana Baru</label>
                              <input required type="number" value={editSubmission.nominal_pengajuan} onChange={(e) => setEditSubmission({...editSubmission, nominal_pengajuan: e.target.value})} className="w-full border p-1.5 text-xs rounded" />
                            </div>
                            <button type="submit" className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors">
                              🚀 Kirim Perbaikan Poin #{selectedRevisionIndex + 1}
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TIMELINE TRACKING LOG KAPAN DAN SUBMIT KEBERAPA */}
              <div className="mt-2 pt-4 border-t border-gray-100 space-y-2">
                <span className="font-bold text-gray-500 uppercase block tracking-wider text-[10px]">Riwayat Urutan Aktivitas & Peninjauan</span>
                <div className="bg-gray-50/70 rounded-xl border border-gray-200 divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {selectedItem.submission_logs && selectedItem.submission_logs.length > 0 ? (
                    selectedItem.submission_logs
                      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) // Log terbaru di atas
                      .map((log, index, arr) => (
                        <div key={log.id} className="p-3 flex justify-between items-start text-[11px]">
                          <div className="space-y-0.5 max-w-[75%]">
                            <p className="font-semibold text-gray-700">{log.note}</p>
                            <p className="text-[10px] text-gray-400">
                              {new Date(log.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} • {new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                            </p>
                          </div>
                          <span className="bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold">
                            #{arr.length - index}
                          </span>
                        </div>
                      ))
                  ) : (
                    <div className="p-4 text-center text-gray-400 text-xs">Belum ada catatan log aktivitas terdaftar.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex gap-2">
              <button onClick={() => { setSelectedItem(null); setIsEditMode(false); }} className="flex-1 py-2.5 font-medium border border-gray-200 rounded-xl hover:bg-gray-100 text-xs text-center">Tutup</button>
              {userRole === 'sa' && (
                <button onClick={handleSaveChanges} className="flex-1 py-2.5 font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-xs shadow-xs">Simpan & Kirim WA</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}