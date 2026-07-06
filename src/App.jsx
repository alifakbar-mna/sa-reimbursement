// src/App.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';

export default function App() {
  // State untuk manajemen halaman/akses
  const [userRole, setUserRole] = useState(null); // 'request', 'sa', atau null
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Khusus untuk SA
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // State untuk Dashboard Keuangan
  const [activeTab, setActiveTab] = useState('on_progress'); // on_progress atau done
  const [submissions, setSubmissions] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(false);

  // State untuk Form Pengajuan Baru (Mahasiswa)
  const [newSubmission, setNewSubmission] = useState({
    ormawa: '',
    nama_kegiatan: '',
    pic_pembina: '',
    bph_kegiatan: '',
    cp_bph: '',
    nominal_pengajuan: ''
  });

  // Ambil data dari Supabase jika yang masuk adalah SA dan sudah Authenticated, ATAU jika Mahasiswa masuk
  useEffect(() => {
    if (userRole === 'sa' && isAuthenticated) {
      fetchSubmissions();
    } else if (userRole === 'request') {
      fetchSubmissions(); // Mahasiswa juga bisa melihat status progress mereka
    }
  }, [activeTab, userRole, isAuthenticated]);

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
      console.error('Gagal mengambil data:', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Fungsi Login untuk khusus Admin/SA
  const handleSALogin = (e) => {
    e.preventDefault();
    if (passwordInput === 'PCSAYUSI') {
      setIsAuthenticated(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  // Fungsi Mahasiswa mengirim pengajuan kasbon/reimburse baru
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
          status_proposal: 'Need Revision' // Default status awal
        }
      ]);

      if (error) throw error;
      alert('Pengajuan berhasil dikirim!');
      setNewSubmission({ ormawa: '', nama_kegiatan: '', pic_pembina: '', bph_kegiatan: '', cp_bph: '', nominal_pengajuan: '' });
      fetchSubmissions();
    } catch (error) {
      alert('Gagal mengirim pengajuan: ' + error.message);
    }
  };

  const handleSaveChanges = async () => {
    if (!selectedItem) return;
    try {
      const updates = {
        status_proposal: selectedItem.status_proposal,
        deadline_revisi: selectedItem.status_proposal === 'Need Revision' ? selectedItem.deadline_revisi : null,
        nomor_rf: selectedItem.nomor_rf,
        is_cair: selectedItem.is_cair,
        tanggal_cair: selectedItem.is_cair ? new Date().toISOString() : null,
      };

      const { error } = await supabase.from('submissions').update(updates).eq('id', selectedItem.id);
      if (error) throw error;

      alert('Data berhasil diperbarui!');
      setSelectedItem(null);
      fetchSubmissions();
    } catch (error) {
      alert('Gagal menyimpan perubahan.');
    }
  };

  const formatRupiah = (num) => {
    if (!num) return 'Rp 0';
    return 'Rp ' + Number(num).toLocaleString('id-ID');
  };

  // ==========================================
  // Halaman 1: GATE UTAMA (PILIH ROLE)
  // ==========================================
  if (!userRole) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-center items-center p-6 antialiased">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-xl p-8 text-center space-y-6">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl mx-auto mb-3 shadow-md shadow-indigo-100">SA</div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Monitoring & Request Dana</h2>
            <p className="text-xs text-gray-400 mt-1">Silakan pilih akses masuk sistem keuangan ORMAWA</p>
          </div>
          
          <div className="flex flex-col gap-3 pt-2">
            <button 
              onClick={() => setUserRole('request')}
              className="w-full py-3 px-4 bg-white border border-gray-200 text-gray-700 font-medium text-sm rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all text-left flex justify-between items-center group"
            >
              <span>Masuk sebagai <strong>Mahasiswa (Request)</strong></span>
              <span className="text-gray-400 group-hover:translate-x-1 transition-transform">&rarr;</span>
            </button>
            <button 
              onClick={() => setUserRole('sa')}
              className="w-full py-3 px-4 bg-indigo-600 text-white font-medium text-sm rounded-xl hover:bg-indigo-700 transition-all shadow-xs text-left flex justify-between items-center group"
            >
              <span>Masuk sebagai <strong>Student Affairs (SA)</strong></span>
              <span className="text-indigo-200 group-hover:translate-x-1 transition-transform">&rarr;</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // Halaman 2: LOGIN KHUSUS ADMIN (SA)
  // ==========================================
  if (userRole === 'sa' && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-center items-center p-6 antialiased">
        <div className="max-w-sm w-full bg-white rounded-2xl border border-gray-200 shadow-xl p-8 space-y-5">
          <button onClick={() => setUserRole(null)} className="text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors">&larr; Kembali</button>
          <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">Otentikasi Student Affairs</h2>
            <p className="text-xs text-gray-400 mt-0.5">Masukkan password khusus SA untuk mengelola berkas</p>
          </div>

          <form onSubmit={handleSALogin} className="space-y-4">
            <div>
              <input 
                type="password" 
                placeholder="Masukkan Password" 
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className={`w-full text-sm border ${passwordError ? 'border-red-400 focus:ring-red-500' : 'border-gray-200 focus:ring-indigo-500'} rounded-xl p-3 focus:outline-hidden focus:ring-1`}
              />
              {passwordError && <p className="text-xs text-red-500 mt-1.5 font-medium">⚠️ Password salah, akses ditolak.</p>}
            </div>
            <button type="submit" className="w-full py-3 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-black transition-all">
              Verifikasi & Masuk
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // TAMPILAN UTAMA (SA DASHBOARD ATAU REQUESTOR SCREEN)
  // ==========================================
  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#334155] font-sans antialiased">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">SA</div>
          <h1 className="text-lg font-semibold tracking-tight text-gray-900">Finance Tracker</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-md">
            Role: {userRole === 'sa' ? 'Kak Dinda (SA)' : 'Mahasiswa'}
          </span>
          <button 
            onClick={() => { setUserRole(null); setIsAuthenticated(false); setPasswordInput(''); }}
            className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
          >
            Keluar/Log Out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* JIKA USER ADALAH MAHASISWA, TAMPILKAN FORM INPUT DI SISI KIRI */}
        {userRole === 'request' && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs space-y-4 h-fit">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">Buat Pengajuan Baru</h3>
            <form onSubmit={handleCreateSubmission} className="space-y-3 text-sm">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Nama ORMAWA</label>
                <input required type="text" placeholder="Contoh: Student Council" value={newSubmission.ormawa} onChange={(e) => setNewSubmission({...newSubmission, ormawa: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 text-xs" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Nama Kegiatan</label>
                <input required type="text" placeholder="Contoh: Open Forum" value={newSubmission.nama_kegiatan} onChange={(e) => setNewSubmission({...newSubmission, nama_kegiatan: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">PIC Pembina</label>
                  <input required type="text" placeholder="Nama Dosen/Pembina" value={newSubmission.pic_pembina} onChange={(e) => setNewSubmission({...newSubmission, pic_pembina: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 text-xs" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">BPH Kegiatan</label>
                  <input required type="text" placeholder="Nama Pengaju" value={newSubmission.bph_kegiatan} onChange={(e) => setNewSubmission({...newSubmission, bph_kegiatan: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 text-xs" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">WhatsApp CP BPH</label>
                <input required type="text" placeholder="081234567xxx" value={newSubmission.cp_bph} onChange={(e) => setNewSubmission({...newSubmission, cp_bph: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 text-xs" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Nominal Dana</label>
                <input required type="number" placeholder="Rp" value={newSubmission.nominal_pengajuan} onChange={(e) => setNewSubmission({...newSubmission, nominal_pengajuan: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 text-xs" />
              </div>
              <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white font-medium text-xs rounded-lg hover:bg-indigo-700 transition-colors shadow-xs mt-2">
                Kirim Pengajuan
              </button>
            </form>
          </div>
        )}

        {/* TABEL TRACKING ANGGARAN (MENGAMBIL KATA KUNCI GRID LUAS SEBAGAI MAUT UTAMA) */}
        <div className={`${userRole === 'request' ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-4`}>
          {/* Tab Switcher */}
          <div className="flex border-b border-gray-200 mb-4 gap-2">
            <button onClick={() => setActiveTab('on_progress')} className={`px-5 py-2 font-medium text-sm border-b-2 ${activeTab === 'on_progress' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>
              On Progress
            </button>
            <button onClick={() => setActiveTab('done')} className={`px-5 py-2 font-medium text-sm border-b-2 ${activeTab === 'done' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>
              Done Pencairan
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-sm text-gray-400">Memuat data dari database...</div>
            ) : submissions.length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-400">Tidak ada data di tab ini.</div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F8F9FA] border-b border-gray-200 font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3">ORMAWA</th>
                    <th className="px-4 py-3">Nama Kegiatan</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Nominal</th>
                    <th className="px-4 py-3">Nomor RF</th>
                    {userRole === 'sa' && <th className="px-4 py-3 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {submissions.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3.5 font-medium text-gray-900">{item.ormawa}</td>
                      <td className="px-4 py-3.5 text-gray-600">{item.nama_kegiatan}</td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          item.status_proposal === 'Diterima' ? 'bg-[#E6F4EA] text-[#137333]' : 
                          item.status_proposal === 'Need Revision' ? 'bg-[#FEF7E0] text-[#B06000]' : 'bg-[#FCE8E6] text-[#C5221F]'
                        }`}>
                          {item.status_proposal}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono">{formatRupiah(item.nominal_pengajuan)}</td>
                      <td className="px-4 py-3.5 font-mono text-gray-400">{item.nomor_rf || '—'}</td>
                      {userRole === 'sa' && (
                        <td className="px-4 py-3.5 text-right">
                          <button onClick={() => setSelectedItem(item)} className="text-indigo-600 hover:text-indigo-900 font-semibold">Kelola</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* Slide-Over Panel Kanan (Hanya diakses Admin/SA) */}
      {selectedItem && userRole === 'sa' && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-gray-900/20 backdrop-blur-xs" onClick={() => setSelectedItem(null)} />
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-gray-200 p-6 space-y-6">
            <div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{selectedItem.ormawa}</span>
              <h3 className="text-base font-semibold text-gray-900">{selectedItem.nama_kegiatan}</h3>
            </div>

            <div className="flex-1 overflow-y-auto space-y-5 text-xs">
              {/* Pilihan Status */}
              <div className="space-y-2">
                <label className="font-semibold text-gray-500 uppercase block">Update Status</label>
                <div className="flex gap-2">
                  {['Diterima', 'Need Revision', 'Reject'].map((st) => (
                    <button 
                      key={st}
                      onClick={() => setSelectedItem({...selectedItem, status_proposal: st})}
                      className={`flex-1 py-2 font-medium rounded-lg border text-center ${selectedItem.status_proposal === st ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold' : 'border-gray-200 text-gray-600'}`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Deadline Input */}
              {selectedItem.status_proposal === 'Need Revision' && (
                <div className="space-y-1">
                  <label className="font-semibold text-gray-500 uppercase block">Deadline Revisi</label>
                  <input type="date" value={selectedItem.deadline_revisi || ''} onChange={(e) => setSelectedItem({...selectedItem, deadline_revisi: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2" />
                </div>
              )}

              {/* Detail RF */}
              <div className="space-y-1 pt-2 border-t border-gray-100">
                <label className="font-semibold text-gray-500 uppercase block">Nomor RF (CIS)</label>
                <input type="text" value={selectedItem.nomor_rf || ''} onChange={(e) => setSelectedItem({...selectedItem, nomor_rf: e.target.value})} placeholder="Contoh: UC/SA/2025-2026/00390" className="w-full font-mono border border-gray-200 rounded-lg p-2" />
              </div>

              {/* Checkbox Pencairan */}
              <div className="flex items-start gap-3 bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                <input type="checkbox" id="is_cair" checked={selectedItem.is_cair || false} onChange={(e) => setSelectedItem({...selectedItem, is_cair: e.target.checked})} className="mt-0.5" />
                <label htmlFor="is_cair" className="text-[11px] text-emerald-800">
                  <strong>Sudah Dicairkan ke Mahasiswa</strong>
                  <span className="block text-gray-400 mt-0.5">Memindahkan baris data ke tab "Done Pencairan"</span>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex gap-2">
              <button onClick={() => setSelectedItem(null)} className="flex-1 py-2.5 font-medium border border-gray-200 rounded-xl hover:bg-gray-100 text-xs">Batal</button>
              <button onClick={handleSaveChanges} className="flex-1 py-2.5 font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-xs">Simpan Perubahan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}