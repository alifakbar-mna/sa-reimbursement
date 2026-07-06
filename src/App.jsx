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

  // State Form Mahasiswa (Requestor) - Status Default: 'On Progress'
  const [newSubmission, setNewSubmission] = useState({
    ormawa: '',
    nama_kegiatan: '',
    pic_pembina: '',
    bph_kegiatan: '',
    cp_bph: '',
    nominal_pengajuan: ''
  });

  // State Array untuk Menampung List Revisi Komponen Dinamis
  const [revisionList, setRevisionList] = useState([{ deadline: '', catatan: '' }]);

  useEffect(() => {
    if (userRole === 'sa' && isAuthenticated) {
      fetchSubmissions();
    } else if (userRole === 'request') {
      fetchSubmissions();
    }
  }, [activeTab, userRole, isAuthenticated]);

  // Sinkronisasi data list revisi saat Kak Dinda membuka item kelolaan baru
  useEffect(() => {
    if (selectedItem) {
      if (selectedItem.revisions && Array.isArray(selectedItem.revisions) && selectedItem.revisions.length > 0) {
        setRevisionList(selectedItem.revisions);
      } else {
        setRevisionList([{ deadline: '', catatan: '' }]);
      }
    }
  }, [selectedItem]);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const isCairValue = activeTab === 'done';
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('is_cair', isCairValue)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error) {
      console.error('Error fetching:', error.message);
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

  // 1. INPUT OLEH MAHASISWA
  // 1. INPUT OLEH MAHASISWA
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
          // Baris revisions: [] telah dihapus agar tidak memicu konflik skema
        }
      ]);

      if (error) throw error;
      
      setNewSubmission({ ormawa: '', nama_kegiatan: '', pic_pembina: '', bph_kegiatan: '', cp_bph: '', nominal_pengajuan: '' });
      fetchSubmissions();
    } catch (error) {
      console.error('Gagal menyimpan pengajuan:', error.message);
    }
  };

  const addRevisionRow = () => {
    setRevisionList([...revisionList, { deadline: '', catatan: '' }]);
  };

  const removeRevisionRow = (index) => {
    const updated = revisionList.filter((_, i) => i !== index);
    setRevisionList(updated.length > 0 ? updated : [{ deadline: '', catatan: '' }]);
  };

  const handleRevisionChange = (index, field, value) => {
    const updated = [...revisionList];
    updated[index][field] = value;
    setRevisionList(updated);
  };

  // 2. TRIGGER WHATSAPP AUTOMATION
  const sendWhatsAppNotification = (item, updatedStatus, updatedRevisions) => {
    let phone = item.cp_bph.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) {
      phone = '62' + phone.substring(1);
    }

    let message = `Halo ${item.bph_kegiatan} (${item.ormawa}),\n\n`;
    message += `Berikut adalah pembaruan status berkas untuk kegiatan *${item.nama_kegiatan}*:\n\n`;
    message += `*Status Terbaru:* _${updatedStatus}_\n`;

    if (item.nomor_rf) {
      message += `*Nomor RF (CIS):* ${item.nomor_rf}\n`;
    }

    if (updatedStatus === 'Need Revision' && updatedRevisions && updatedRevisions.length > 0) {
      message += `\n*Daftar Catatan Revisi & Deadline:*\n`;
      updatedRevisions.forEach((rev, idx) => {
        if (rev.catat || rev.catatan) {
          message += `${idx + 1}. Poin: ${rev.catatan || rev.catat}\n   Tenggat: *${rev.deadline || '—'}*\n`;
        }
      });
    } else if (updatedStatus === 'On Progress') {
      message += `\nBerkas pengajuan Anda sedang dalam proses peninjauan kembali (On Progress) oleh Student Affairs.\n`;
    } else if (updatedStatus === 'Diterima') {
      message += `\nSelamat! Berkas kamu telah disetujui oleh Student Affairs. Silakan memantau proses pencairan dana secara berkala.\n`;
    } else if (updatedStatus === 'Reject') {
      message += `\nMohon maaf, berkas pengajuan Anda belum dapat kami setujui.\n`;
    }

    message += `\nTerima kasih,\n*Student Affairs Finance Department*`;

    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank'); 
  };

  // 3. SIMPAN PERUBAHAN OLEH SA
  const handleSaveChanges = async () => {
    if (!selectedItem) return;

    try {
      const validRevisions = revisionList.filter(r => r.deadline !== '' || r.catatan !== '');

      const updates = {
        status_proposal: selectedItem.status_proposal,
        nomor_rf: selectedItem.nomor_rf,
        is_cair: selectedItem.is_cair,
        tanggal_cair: selectedItem.is_cair ? new Date().toISOString() : null,
        revisions: validRevisions 
      };

      const { error } = await supabase
        .from('submissions')
        .update(updates)
        .eq('id', selectedItem.id);

      if (error) throw error;

      alert('Data berhasil disimpan!');
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
                    <th className="px-4 py-3">Nomor RF</th>
                    {userRole === 'sa' && <th className="px-4 py-3 text-right">Tindakan</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {submissions.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3.5 font-medium text-gray-900">{item.ormawa}</td>
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
                      <td className="px-4 py-3.5 font-mono text-gray-400">{item.nomor_rf || '—'}</td>
                      {userRole === 'sa' && (
                        <td className="px-4 py-3.5 text-right"><button onClick={() => setSelectedItem(item)} className="text-indigo-600 hover:text-indigo-900 font-bold">Kelola</button></td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* PANEL SLIDE-OVER KANAN */}
      {selectedItem && userRole === 'sa' && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-gray-900/20 backdrop-blur-xs" onClick={() => setSelectedItem(null)} />
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-gray-200 p-6 space-y-5">
            <div>
              <span className="text-xs font-bold text-gray-400 uppercase">{selectedItem.ormawa}</span>
              <h3 className="text-base font-semibold text-gray-900">{selectedItem.nama_kegiatan}</h3>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-gray-500 uppercase block">Ubah Status Berkas</label>
                <div className="flex flex-wrap gap-2">
                  {['On Progress', 'Diterima', 'Need Revision', 'Reject'].map((st) => (
                    <button key={st} onClick={() => setSelectedItem({...selectedItem, status_proposal: st})} className={`flex-1 min-w-[100px] py-2 font-medium rounded-lg border text-center transition-all ${selectedItem.status_proposal === st ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold shadow-xs' : 'border-gray-200 text-gray-600'}`}>{st}</button>
                  ))}
                </div>
              </div>

              {selectedItem.status_proposal === 'Need Revision' && (
                <div className="space-y-3 bg-amber-50/40 p-4 rounded-xl border border-amber-100">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-amber-800 uppercase block">Daftar Poin Catatan Revisi</label>
                  </div>
                  
                  {revisionList.map((rev, index) => (
                    <div key={index} className="p-3 bg-white border border-amber-200 rounded-lg space-y-2 relative shadow-xs">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-gray-400 block mb-0.5">Tenggat Waktu (Deadline)</label>
                          <input type="date" value={rev.deadline || ''} onChange={(e) => handleRevisionChange(index, 'deadline', e.target.value)} className="w-full border border-gray-200 rounded-md p-1.5 text-xs" />
                        </div>
                        {revisionList.length > 1 && (
                          <button onClick={() => removeRevisionRow(index)} className="text-red-500 hover:text-red-700 font-bold self-end px-2 py-1">&times;</button>
                        )}
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
            </div>

            <div className="pt-4 border-t border-gray-100 flex gap-2">
              <button onClick={() => setSelectedItem(null)} className="flex-1 py-2.5 font-medium border border-gray-200 rounded-xl hover:bg-gray-100 text-xs">Batal</button>
              <button onClick={handleSaveChanges} className="flex-1 py-2.5 font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-xs shadow-xs">Simpan & Kirim WA</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}