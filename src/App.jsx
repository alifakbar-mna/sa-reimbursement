// src/App.jsx (Pembaruan Fitur Multi-Revision & Deadline Coloring)
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';

export default function App() {
  // ... (State bawaan tetap dipertahankan seperti code awal kamu) ...
  const [userRole, setUserRole] = useState(null); 
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [activeTab, setActiveTab] = useState('On Progress');
  const [submissions, setSubmissions] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(false);

  // State untuk form edit revisi mahasiswa
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedRevType, setSelectedRevType] = useState(''); // 'rev1' atau 'rev2'
  const [editSubmission, setEditSubmission] = useState({
    nama_kegiatan: '',
    nominal_pengajuan: ''
  });

  // State input revisi untuk Kak Dinda
  const [rev1Input, setRev1Input] = useState({ catatan: '', deadline: '', aktif: false });
  const [rev2Input, setRev2Input] = useState({ catatan: '', deadline: '', aktif: false });

  useEffect(() => {
    if ((userRole === 'sa' && isAuthenticated) || userRole === 'request') {
      fetchSubmissions();
    }
  }, [activeTab, userRole, isAuthenticated]);

  useEffect(() => {
    if (selectedItem) {
      setRev1Input({
        catatan: selectedItem.catatan_rev1 || '',
        deadline: selectedItem.dl_rev1 || '',
        aktif: selectedItem.status_rev1 ? true : false
      });
      setRev2Input({
        catatan: selectedItem.catatan_rev2 || '',
        deadline: selectedItem.dl_rev2 || '',
        aktif: selectedItem.status_rev2 ? true : false
      });
      setEditSubmission({
        nama_kegiatan: selectedItem.nama_kegiatan || '',
        nominal_pengajuan: selectedItem.nominal_pengajuan || ''
      });
    } else {
      setIsEditMode(false);
      setSelectedRevType('');
    }
  }, [selectedItem]);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const isCairValue = activeTab === 'done';
      const { data, error } = await supabase
        .from('submissions')
        .select(`*, submission_logs (*)`)
        .eq('is_cair', isCairValue)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error) {
      console.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // 1. LOGIKA WARNA DEADLINE (H-1 KUNING, LEWAT DL MERAH)
  const getDeadlineStyle = (deadlineStr) => {
    if (!deadlineStr) return '';
    const today = new Date();
    today.setHours(0,0,0,0);
    const dlDate = new Date(deadlineStr);
    dlDate.setHours(0,0,0,0);

    const diffTime = dlDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return 'bg-red-100 border-l-4 border-red-500 text-red-900'; // Lewat DL (Merah)
    } else if (diffDays <= 1) {
      return 'bg-amber-100 border-l-4 border-amber-500 text-amber-900'; // H-1 atau Hari H (Kuning)
    }
    return 'bg-gray-50 text-gray-700';
  };

  // 2. PROSES SUBMIT REVISI OLEH MAHASISWA
  const handleResubmitRevision = async (e) => {
    e.preventDefault();
    if (!selectedItem || !selectedRevType) return;

    try {
      const now = new Date().toISOString();
      const updates = {
        nama_kegiatan: editSubmission.nama_kegiatan,
        nominal_pengajuan: parseFloat(editSubmission.nominal_pengajuan) || 0,
      };

      // Tentukan apakah ini submit pertama kali atau submit ulang (resubmit) karena disuruh revisi lagi
      if (selectedRevType === 'rev1') {
        updates.status_rev1 = 'Submitted';
        if (!selectedItem.sub_rev1_at) {
          updates.sub_rev1_at = now; // Kapan pertama disubmit
        } else {
          updates.resub_rev1_at = now; // Kapan disubmit ulang
        }
      } else {
        updates.status_rev2 = 'Submitted';
        if (!selectedItem.sub_rev2_at) {
          updates.sub_rev2_at = now;
        } else {
          updates.resub_rev2_at = now;
        }
      }

      // Cek apakah dengan submit ini, seluruh revisi yang ditugaskan sudah rampung
      const checkRev1Status = selectedRevType === 'rev1' ? 'Submitted' : (selectedItem.status_rev1 || 'Submitted');
      const checkRev2Status = selectedRevType === 'rev2' ? 'Submitted' : (selectedItem.status_rev2 || 'Submitted');

      if (checkRev1Status === 'Submitted' && checkRev2Status === 'Submitted') {
        updates.status_proposal = 'On Progress';
      } else {
        updates.status_proposal = 'Need Revision';
      }

      const { error: updateError } = await supabase
        .from('submissions')
        .update(updates)
        .eq('id', selectedItem.id);

      if (updateError) throw updateError;

      await supabase.from('submission_logs').insert([
        { 
          submission_id: selectedItem.id, 
          note: `Mahasiswa men-submit perbaikan ${selectedRevType === 'rev1' ? 'Revisi 1' : 'Revisi 2'}.` 
        }
      ]);

      alert('Revisi berhasil dikirim!');
      setIsEditMode(false);
      setSelectedItem(null);
      fetchSubmissions();
    } catch (error) {
      alert(error.message);
    }
  };

  // 3. PROSES SIMPAN PERUBAHAN OLEH KAK DINDA (SA)
  const handleSaveChanges = async () => {
    if (!selectedItem) return;

    try {
      const updates = {
        status_proposal: selectedItem.status_proposal,
        nomor_rf: selectedItem.nomor_rf,
        is_cair: selectedItem.is_cair,
        tanggal_cair: selectedItem.is_cair ? new Date().toISOString() : null,
      };

      if (selectedItem.status_proposal === 'Need Revision') {
        updates.catatan_rev1 = rev1Input.aktif ? rev1Input.catatan : null;
        updates.dl_rev1 = rev1Input.aktif ? rev1Input.deadline : null;
        // Jika sebelumnya sudah 'Submitted' tapi Kak Dinda menyuruh revisi lagi, kembalikan ke 'Need Revision'
        updates.status_rev1 = rev1Input.aktif ? (selectedItem.status_rev1 === 'Submitted' ? 'Need Revision' : selectedItem.status_rev1 || 'Need Revision') : null;

        updates.catatan_rev2 = rev2Input.aktif ? rev2Input.catatan : null;
        updates.dl_rev2 = rev2Input.aktif ? rev2Input.deadline : null;
        updates.status_rev2 = rev2Input.aktif ? (selectedItem.status_rev2 === 'Submitted' ? 'Need Revision' : selectedItem.status_rev2 || 'Need Revision') : null;
      }

      const { error: updateError } = await supabase
        .from('submissions')
        .update(updates)
        .eq('id', selectedItem.id);

      if (updateError) throw updateError;

      await supabase.from('submission_logs').insert([
        { submission_id: selectedItem.id, note: `Kak Dinda memperbarui status berkas menjadi [${selectedItem.status_proposal}]` }
      ]);

      alert('Perubahan berhasil disimpan oleh SA!');
      setSelectedItem(null);
      fetchSubmissions();
    } catch (error) {
      alert(error.message);
    }
  };

  const formatRupiah = (num) => !num ? 'Rp 0' : 'Rp ' + Number(num).toLocaleString('id-ID');
  const formatTgl = (tglStr) => !tglStr ? '—' : new Date(tglStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' WIB';

  if (userRole === null) { /* ... UI Pintu Gerbang ... */ return (<div className="p-10 text-center"><button onClick={() => setUserRole('request')} className="p-3 bg-indigo-600 text-white rounded">Masuk Mahasiswa</button> <button onClick={() => {setUserRole('sa'); setIsAuthenticated(true);}} className="p-3 bg-gray-600 text-white rounded ml-2">Masuk Kak Dinda</button></div>); }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#334155]">
      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">Finance Tracker — Multi Revision System</h1>
        <button onClick={() => setUserRole(null)} className="text-xs text-red-500 font-medium">Kelola Akses ({userRole})</button>
      </header>

      {/* MAIN LAYOUT */}
      <main className="max-w-7xl mx-auto px-8 py-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8F9FA] border-b border-gray-200 font-semibold text-gray-500 uppercase">
                <th className="px-4 py-3">ORMAWA</th>
                <th className="px-4 py-3">Nama Kegiatan</th>
                <th className="px-4 py-3">Status Utama</th>
                <th className="px-4 py-3">Status Rev 1</th>
                <th className="px-4 py-3">Status Rev 2</th>
                <th className="px-4 py-3 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {submissions.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3.5 font-medium text-gray-900">{item.ormawa}</td>
                  <td className="px-4 py-3.5 text-gray-600">{item.nama_kegiatan}</td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${item.status_proposal === 'Need Revision' ? 'bg-[#FEF7E0] text-[#B06000]' : 'bg-[#E8F0FE] text-[#1A73E8]'}`}>{item.status_proposal}</span>
                  </td>
                  <td className={`px-4 py-3.5 ${getDeadlineStyle(item.dl_rev1)}`}>
                    {item.status_rev1 ? (
                      <div>
                        <span className="font-bold">{item.status_rev1}</span>
                        <span className="block text-[10px] opacity-70">DL: {item.dl_rev1 || '—'}</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td className={`px-4 py-3.5 ${getDeadlineStyle(item.dl_rev2)}`}>
                    {item.status_rev2 ? (
                      <div>
                        <span className="font-bold">{item.status_rev2}</span>
                        <span className="block text-[10px] opacity-70">DL: {item.dl_rev2 || '—'}</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button onClick={() => setSelectedItem(item)} className="text-indigo-600 hover:text-indigo-900 font-bold bg-indigo-50 px-2 py-1 rounded">Detail / Aksi</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* DETAIL SIDE PANEL OVERLAY */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-gray-900/20 backdrop-blur-xs" onClick={() => setSelectedItem(null)} />
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col p-6 space-y-5 overflow-y-auto">
            <div>
              <span className="text-xs font-bold text-gray-400 uppercase">{selectedItem.ormawa}</span>
              <h3 className="text-base font-semibold text-gray-900">{selectedItem.nama_kegiatan}</h3>
            </div>

            {/* PANEL KAK DINDA (SA) */}
            {userRole === 'sa' && (
              <div className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-bold text-gray-500 uppercase block">Ubah Status Utama Berkas</label>
                  <div className="flex gap-2">
                    {['On Progress', 'Need Revision', 'Diterima'].map((st) => (
                      <button key={st} onClick={() => setSelectedItem({...selectedItem, status_proposal: st})} className={`flex-1 py-2 font-medium rounded-lg border text-center ${selectedItem.status_proposal === st ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold' : 'border-gray-200'}`}>{st}</button>
                    ))}
                  </div>
                </div>

                {selectedItem.status_proposal === 'Need Revision' && (
                  <div className="space-y-3 bg-amber-50/50 p-3 rounded-lg border border-amber-200">
                    <h4 className="font-bold text-amber-900 uppercase text-[10px]">Pemberian Tugas Revisi</h4>
                    
                    {/* INPUT REVISI 1 */}
                    <div className="p-3 bg-white rounded border space-y-2">
                      <label className="flex items-center gap-1.5 font-semibold text-gray-700">
                        <input type="checkbox" checked={rev1Input.aktif} onChange={(e) => setRev1Input({...rev1Input, aktif: e.target.checked})} /> Aktifkan Revisi Pertama (Rev 1)
                      </label>
                      {rev1Input.aktif && (
                        <>
                          <input type="date" value={rev1Input.deadline} onChange={(e) => setRev1Input({...rev1Input, deadline: e.target.value})} className="w-full border p-1 rounded" />
                          <textarea placeholder="Catatan untuk revisi pertama..." value={rev1Input.catatan} onChange={(e) => setRev1Input({...rev1Input, catatan: e.target.value})} className="w-full border p-1 rounded" rows="2" />
                          <div className="text-[10px] text-gray-400 space-y-0.5">
                            <p>⏱️ Pertama Submit: {formatTgl(selectedItem.sub_rev1_at)}</p>
                            <p>🔄 Submit Ulang: {formatTgl(selectedItem.resub_rev1_at)}</p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* INPUT REVISI 2 */}
                    <div className="p-3 bg-white rounded border space-y-2">
                      <label className="flex items-center gap-1.5 font-semibold text-gray-700">
                        <input type="checkbox" checked={rev2Input.aktif} onChange={(e) => setRev2Input({...rev2Input, aktif: e.target.checked})} /> Aktifkan Revisi Kedua (Rev 2)
                      </label>
                      {rev2Input.aktif && (
                        <>
                          <input type="date" value={rev2Input.deadline} onChange={(e) => setRev2Input({...rev2Input, deadline: e.target.value})} className="w-full border p-1 rounded" />
                          <textarea placeholder="Catatan untuk revisi kedua..." value={rev2Input.catatan} onChange={(e) => setRev2Input({...rev2Input, catatan: e.target.value})} className="w-full border p-1 rounded" rows="2" />
                          <div className="text-[10px] text-gray-400 space-y-0.5">
                            <p>⏱️ Pertama Submit: {formatTgl(selectedItem.sub_rev2_at)}</p>
                            <p>🔄 Submit Ulang: {formatTgl(selectedItem.resub_rev2_at)}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
                <button onClick={handleSaveChanges} className="w-full py-2 bg-indigo-600 text-white rounded font-bold">Simpan Perubahan SA</button>
              </div>
            )}

            {/* PANEL MAHASISWA */}
            {userRole === 'request' && (
              <div className="space-y-4 text-xs">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                  <h4 className="font-bold text-gray-700 uppercase text-[10px]">Daftar Instruksi & Pengerjaan Revisi</h4>
                  
                  {/* AKSI REVISI 1 */}
                  {selectedItem.status_rev1 && (
                    <div className="p-3 bg-white rounded border shadow-xs space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-800">Revisi 1: <span className="text-indigo-600">{selectedItem.status_rev1}</span></span>
                        <span className="text-red-500 font-mono font-semibold">DL: {selectedItem.dl_rev1}</span>
                      </div>
                      <p className="text-gray-600 bg-gray-50 p-1.5 rounded">📌 {selectedItem.catatan_rev1}</p>
                      <button onClick={() => { setSelectedRevType('rev1'); setIsEditMode(true); }} className="mt-1 px-3 py-1 bg-amber-500 text-white font-bold rounded hover:bg-amber-600">Kerjakan / Submit Rev 1</button>
                    </div>
                  )}

                  {/* AKSI REVISI 2 */}
                  {selectedItem.status_rev2 && (
                    <div className="p-3 bg-white rounded border shadow-xs space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-800">Revisi 2: <span className="text-indigo-600">{selectedItem.status_rev2}</span></span>
                        <span className="text-red-500 font-mono font-semibold">DL: {selectedItem.dl_rev2}</span>
                      </div>
                      <p className="text-gray-600 bg-gray-50 p-1.5 rounded">📌 {selectedItem.catatan_rev2}</p>
                      <button onClick={() => { setSelectedRevType('rev2'); setIsEditMode(true); }} className="mt-1 px-3 py-1 bg-amber-500 text-white font-bold rounded hover:bg-amber-600">Kerjakan / Submit Rev 2</button>
                    </div>
                  )}
                </div>

                {/* FORM INPUT SUBMIT JIKA MAHASISWA MEMILIH SALAH SATU REVISI */}
                {isEditMode && (
                  <form onSubmit={handleResubmitRevision} className="bg-amber-50/40 p-4 border border-amber-200 rounded-xl space-y-3">
                    <span className="font-bold text-amber-900 block">Mengisi Perbaikan Untuk: {selectedRevType === 'rev1' ? 'Revisi Ke-1' : 'Revisi Ke-2'}</span>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">Nama Kegiatan Terkini</label>
                      <input required type="text" value={editSubmission.nama_kegiatan} onChange={(e) => setEditSubmission({...editSubmission, nama_kegiatan: e.target.value})} className="w-full border p-1.5 rounded text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">Nominal Dana Baru</label>
                      <input required type="number" value={editSubmission.nominal_pengajuan} onChange={(e) => setEditSubmission({...editSubmission, nominal_pengajuan: e.target.value})} className="w-full border p-1.5 rounded text-xs" />
                    </div>
                    <button type="submit" className="w-full py-2 bg-emerald-600 text-white font-bold rounded">Kirim File Hasil Perbaikan</button>
                  </form>
                )}
              </div>
            )}
            
            <button onClick={() => setSelectedItem(null)} className="w-full py-2 border text-gray-500 rounded text-xs font-semibold">Tutup Panel</button>
          </div>
        </div>
      )}
    </div>
  );
}