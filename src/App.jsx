import React, { useState, useEffect } from 'react';

// --- UTILITY FUNCTIONS ---
const formatRupiah = (number) => {
  if (number === undefined || number === null) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(number);
};

const getDeadlineAlertClass = (deadlineDate, status) => {
  if (status === 'Submited' || !deadlineDate) return 'bg-gray-50 border-gray-200 text-gray-800';
  
  const today = new Date();
  const dl = new Date(deadlineDate);
  const diffTime = dl - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'bg-rose-50 border-rose-200 text-rose-900 animate-pulse'; // Lewat deadline
  if (diffDays <= 2) return 'bg-amber-50 border-amber-200 text-amber-900'; // Mepet (<= 2 hari)
  return 'bg-indigo-50 border-indigo-100 text-indigo-900';
};

export default function App() {
  // --- STATE MANAGEMENT ---
  const [userRole, setUserRole] = useState('request'); // 'request' = Mahasiswa, 'sa' = Kak Dinda/Admin
  const [submissions, setSubmissions] = useState([
    {
      id: 'prop-01',
      nama_kegiatan: 'Ciputra Annual Choir Concert 2026',
      nominal_pengajuan: 15000000,
      status_proposal: 'Need Revision',
      created_at: '2026-07-01T08:00:00.000Z',
      submission_logs: [
        { id: 'log-1', note: 'Proposal diajukan oleh Mahasiswa.', created_at: '2026-07-01T08:00:00.000Z' },
        { id: 'log-2', note: 'Status diubah ke Need Revision oleh Kak Dinda.', created_at: '2026-07-03T10:00:00.000Z' }
      ]
    },
    {
      id: 'prop-02',
      nama_kegiatan: 'Workshop Mobile Dev with SwiftUI',
      nominal_pengajuan: 4500000,
      status_proposal: 'Approved',
      created_at: '2026-07-05T09:30:00.000Z',
      submission_logs: [
        { id: 'log-3', note: 'Proposal diajukan oleh Mahasiswa.', created_at: '2026-07-05T09:30:00.000Z' },
        { id: 'log-4', note: 'Proposal disetujui penuh oleh Kak Dinda.', created_at: '2026-07-06T14:00:00.000Z' }
      ]
    }
  ]);

  const [revisionList, setRevisionList] = useState([
    { id: 'rev-01', submission_id: 'prop-01', catatan: 'Lampiran Rencana Anggaran Biaya (RAB) belum detail di bagian sewa sound system.', deadline: '2026-07-12', status: 'Pending' },
    { id: 'rev-02', submission_id: 'prop-01', catatan: 'Tanda tangan pembina ormawa belum terlampir pada lembar pengesahan.', deadline: '2026-07-15', status: 'Pending' }
  ]);

  // UI States
  const [selectedItem, setSelectedItem] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedRevisionId, setSelectedRevisionId] = useState('');
  
  // Form States (Kak Dinda / Admin)
  const [adminStatus, setAdminStatus] = useState('');
  const [newRevisionText, setNewRevisionText] = useState('');
  const [newRevisionDL, setNewRevisionDL] = useState('');

  // Form States (Mahasiswa / Edit Mode)
  const [editSubmission, setEditSubmission] = useState({
    nama_kegiatan: '',
    nominal_pengajuan: 0
  });

  // Sinkronisasi data ke Form Edit ketika Mahasiswa menekan tombol perbaikan
  useEffect(() => {
    if (selectedItem) {
      setEditSubmission({
        nama_kegiatan: selectedItem.nama_kegiatan,
        nominal_pengajuan: selectedItem.nominal_pengajuan
      });
      setAdminStatus(selectedItem.status_proposal);
    }
  }, [selectedItem]);

  // --- HANDLERS (ADMIN / KAK DINDA) ---
  const handleAddRevisionPoint = () => {
    if (!newRevisionText.trim() || !newRevisionDL) return alert('Isi catatan revisi & deadline terlebih dahulu!');
    
    const newRev = {
      id: `rev-${Date.now()}`,
      submission_id: selectedItem.id,
      catatan: newRevisionText,
      deadline: newRevisionDL,
      status: 'Pending'
    };

    setRevisionList([...revisionList, newRev]);
    setNewRevisionText('');
    setNewRevisionDL('');
  };

  const handleSaveChanges = () => {
    // Aksi simpan perubahan status dan data oleh Kak Dinda
    const updatedSubmissions = submissions.map((sub) => {
      if (sub.id === selectedItem.id) {
        const logs = [...sub.submission_logs];
        if (sub.status_proposal !== adminStatus) {
          logs.unshift({
            id: `log-${Date.now()}`,
            note: `Status proposal diubah dari ${sub.status_proposal} menjadi ${adminStatus} oleh Admin.`,
            created_at: new Date().toISOString()
          });
        }
        return { ...sub, status_proposal: adminStatus, submission_logs: logs };
      }
      return sub;
    });

    setSubmissions(updatedSubmissions);
    alert(`Berhasil memperbarui status berkas! Simulasi pesan WhatsApp terkirim ke mahasiswa.`);
    setSelectedItem(null);
  };

  // --- HANDLERS (MAHASISWA / REQUESTER) ---
  const handleResubmitSubmission = (e) => {
    e.preventDefault();

    // 1. Update status revisi spesifik menjadi 'Submited'
    const updatedRevisions = revisionList.map((rev) => {
      if (rev.id === selectedRevisionId) {
        return { ...rev, status: 'Submited' };
      }
      return rev;
    });
    setRevisionList(updatedRevisions);

    // 2. Cek apakah masih ada sisa revisi yang pending untuk berkas ini
    const remainingPending = updatedRevisions.filter(
      (rev) => rev.submission_id === selectedItem.id && rev.status === 'Pending'
    );

    // 3. Update data pengajuan proposal mahasiswa & buat log baru
    const updatedSubmissions = submissions.map((sub) => {
      if (sub.id === selectedItem.id) {
        const logs = [...sub.submission_logs];
        logs.unshift({
          id: `log-${Date.now()}`,
          note: `Mahasiswa mengirimkan berkas perbaikan untuk poin instruksi terkait.`,
          created_at: new Date().toISOString()
        });

        return {
          ...sub,
          nama_kegiatan: editSubmission.nama_kegiatan,
          nominal_pengajuan: parseInt(editSubmission.nominal_pengajuan) || 0,
          // Jika semua DL sudah disubmit, ubah status global proposal ke 'On Progress' / 'Resubmitted'
          status_proposal: remainingPending.length === 0 ? 'On Progress' : 'Need Revision',
          submission_logs: logs
        };
      }
      return sub;
    });

    setSubmissions(updatedSubmissions);
    alert('Perbaikan komponen berkas berhasil dikirim ke Admin!');
    
    // Reset UI Panel State
    setIsEditMode(false);
    setSelectedRevisionId('');
    setSelectedItem(null);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6 font-sans text-gray-800">
      
      {/* HEADER & ROLE TOGGLE */}
      <header className="max-w-5xl mx-auto mb-8 flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-2xl shadow-xs gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">📁 Proposal Hub Universitas</h1>
          <p className="text-xs text-gray-500">Sistem Pelacakan & Validasi Berkas Organisasi</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl border border-gray-200">
          <button 
            onClick={() => { setUserRole('request'); setSelectedItem(null); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${userRole === 'request' ? 'bg-white text-indigo-600 shadow-xs' : 'text-gray-500'}`}
          >
            Sisi Mahasiswa
          </button>
          <button 
            onClick={() => { setUserRole('sa'); setSelectedItem(null); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${userRole === 'sa' ? 'bg-white text-indigo-600 shadow-xs' : 'text-gray-500'}`}
          >
            Sisi Kak Dinda (Admin)
          </button>
        </div>
      </header>

      {/* MAIN CONTENT DASHBOARD */}
      <main className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-bold text-slate-900 text-sm">Daftar Pengajuan Aktif ({submissions.length})</h2>
            <span className="text-[10px] bg-indigo-100 text-indigo-700 font-extrabold px-2 py-0.5 rounded-md uppercase">Mode: {userRole === 'sa' ? 'Administrator' : 'Ormawa'}</span>
          </div>

          <div className="divide-y divide-gray-100">
            {submissions.map((item) => {
              const itemRevisions = revisionList.filter((r) => r.submission_id === item.id);
              return (
                <div key={item.id} className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-slate-50/50 transition-colors">
                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-400 font-mono block">{item.id}</span>
                    <h3 className="font-bold text-gray-900 text-sm">{item.nama_kegiatan}</h3>
                    <div className="flex gap-4 text-xs text-gray-500 items-center pt-0.5">
                      <span className="font-mono font-semibold text-slate-700">{formatRupiah(item.nominal_pengajuan)}</span>
                      <span>•</span>
                      <span>Diajukan: {new Date(item.created_at).toLocaleDateString('id-ID')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${
                      item.status_proposal === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                      item.status_proposal === 'Need Revision' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {item.status_proposal}
                    </span>
                    
                    <button 
                      onClick={() => { setSelectedItem(item); setIsEditMode(false); }}
                      className="px-4 py-2 bg-white border border-gray-200 hover:border-gray-300 rounded-xl text-xs font-semibold text-gray-700 shadow-xs transition-colors"
                    >
                      Lihat Detail
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* SLIDE-OVER / DETAILED MODAL PANEL */}
      {selectedItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50 animate-fadeIn">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col p-6 overflow-y-auto animate-slideLeft">
            
            {/* PANEL HEADER */}
            <div className="flex justify-between items-start border-b border-gray-100 pb-4 mb-4">
              <div>
                <span className="text-[10px] font-mono text-gray-400 block">{selectedItem.id}</span>
                <h3 className="font-black text-slate-900 text-base">{selectedItem.nama_kegiatan}</h3>
              </div>
              <button 
                onClick={() => { setSelectedItem(null); setIsEditMode(false); }}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 font-bold"
              >
                &times;
              </button>
            </div>

            {/* PANEL CONTENT CORE */}
            <div className="flex-1 space-y-6">
              
              {/* --- INTERFACE KAK DINDA (ADMIN ROLE) --- */}
              {userRole === 'sa' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-gray-500 uppercase tracking-wider text-[10px]">Validasi Status Proposal</label>
                    <select 
                      value={adminStatus} 
                      onChange={(e) => setAdminStatus(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl p-2.5 text-xs font-medium bg-gray-50"
                    >
                      <option value="On Progress">On Progress (Pengecekan)</option>
                      <option value="Need Revision">Need Revision (Butuh Perbaikan)</option>
                      <option value="Approved">Approved (Disetujui)</option>
                    </select>
                  </div>

                  {adminStatus === 'Need Revision' && (
                    <div className="bg-rose-50/60 p-4 rounded-2xl border border-rose-100 space-y-3">
                      <span className="text-rose-950 font-bold text-[11px] block">📝 Tambah Poin Intoleransi Perbaikan (Deadline Checklist)</span>
                      
                      <div className="space-y-2">
                        <textarea 
                          placeholder="Contoh: Perbaiki rincian nota sewa tempat..." 
                          value={newRevisionText} 
                          onChange={(e) => setNewRevisionText(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg p-2 text-xs bg-white h-16 resize-none"
                        />
                        <div className="flex flex-col space-y-1">
                          <label className="text-[9px] text-gray-400 font-bold uppercase">Tanggal Batas Waktu (DL)</label>
                          <input 
                            type="date" 
                            value={newRevisionDL} 
                            onChange={(e) => setNewRevisionDL(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg p-2 text-xs bg-white" 
                          />
                        </div>
                        <button 
                          type="button" 
                          onClick={handleAddRevisionPoint} 
                          className="w-full py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-colors"
                        >
                          + Tambahkan Ke Daftar Tenggat
                        </button>
                      </div>

                      {/* Preview List Revisi yang Dibuat Admin */}
                      <div className="pt-2 border-t border-rose-100 space-y-2">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block">Daftar Poin Saat Ini:</span>
                        {revisionList.filter(r => r.submission_id === selectedItem.id).map((rev, idx) => (
                          <div key={rev.id} className="text-xs bg-white border border-gray-100 p-2 rounded-lg">
                            <p className="font-semibold text-gray-800">{idx + 1}. {rev.catatan}</p>
                            <span className="text-[9px] text-rose-600 block font-medium mt-0.5">DL: {rev.deadline} ({rev.status})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* --- INTERFACE MAHASISWA (USER ROLE) --- */}
              {userRole === 'request' && (
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                    <div>
                      <span className="text-gray-400 block uppercase font-bold text-[10px]">Status Proposal</span>
                      <span className="text-xs font-bold text-gray-800">{selectedItem.status_proposal}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block uppercase font-bold text-[10px]">Nominal Dana Saat Ini</span>
                      <span className="text-xs font-mono font-bold text-gray-800">{formatRupiah(selectedItem.nominal_pengajuan)}</span>
                    </div>

                    {selectedItem.status_proposal === 'Need Revision' && (
                      <div className="mt-2 pt-3 border-t border-gray-200 space-y-3">
                        <span className="text-slate-700 block uppercase font-bold text-[10px] tracking-wide">📌 Daftar Instruksi Perbaikan Dari Kak Dinda:</span>
                        
                        <div className="space-y-2.5">
                          {revisionList
                            .filter((r) => r.submission_id === selectedItem.id)
                            .map((rev) => (
                              <div key={rev.id} className={`p-3 border rounded-lg shadow-sm flex flex-col space-y-2 ${getDeadlineAlertClass(rev.deadline, rev.status)}`}>
                                <div className="flex justify-between items-start border-b pb-1">
                                  <span className="font-bold text-gray-500 text-[10px]">Tenggat: {rev.deadline ? new Date(rev.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</span>
                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${rev.status === 'Submited' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{rev.status || 'Pending'}</span>
                                </div>
                                <p className="whitespace-pre-line text-gray-800 font-medium text-xs">
                                  {rev.catatan || 'Ada revisi pada berkas.'}
                                </p>
                                
                                {rev.status !== 'Submited' && !isEditMode && (
                                  <button 
                                    type="button" 
                                    onClick={() => { setSelectedRevisionId(rev.id); setIsEditMode(true); }} 
                                    className="mt-1 self-end py-1 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-md transition-colors"
                                  >
                                    Submit Ulang DL Ini
                                  </button>
                                )}
                              </div>
                            ))}
                        </div>

                        {/* FORM MAHASISWA SUBMIT PERBAIKAN (EDIT MODE) */}
                        {isEditMode && (
                          <form onSubmit={handleResubmitSubmission} className="bg-white border border-indigo-200 rounded-xl p-4 space-y-3 text-left mt-4 shadow-md animate-fadeIn">
                            <div className="flex justify-between items-center border-b pb-1.5">
                              <span className="font-bold text-indigo-950 text-xs">Form Perbaikan Berkas</span>
                              <button type="button" onClick={() => { setIsEditMode(false); setSelectedRevisionId(''); }} className="text-gray-400 hover:text-gray-600 font-bold text-sm">&times;</button>
                            </div>

                            <div>
                              <label className="text-[10px] text-gray-400 block mb-1">Nama Kegiatan (Sesuaikan Jika Ada Revisi)</label>
                              <input 
                                required 
                                type="text" 
                                value={editSubmission.nama_kegiatan} 
                                onChange={(e) => setEditSubmission({...editSubmission, nama_kegiatan: e.target.value})} 
                                className="w-full border border-gray-200 rounded-lg p-2 text-xs" 
                              />
                            </div>

                            <div>
                              <label className="text-[10px] text-gray-400 block mb-1">Nominal Pengajuan Baru (Rp)</label>
                              <input 
                                required 
                                type="number" 
                                value={editSubmission.nominal_pengajuan} 
                                onChange={(e) => setEditSubmission({...editSubmission, nominal_pengajuan: e.target.value})} 
                                className="w-full border border-gray-200 rounded-lg p-2 text-xs" 
                              />
                            </div>

                            <div className="flex gap-2 pt-1">
                              <button 
                                type="button" 
                                onClick={() => { setIsEditMode(false); setSelectedRevisionId(''); }} 
                                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-lg transition-colors"
                              >
                                Batal
                              </button>
                              <button 
                                type="submit" 
                                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-xs"
                              >
                                Kirim Perbaikan
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* HISTORI LOG PROPOSAL (KEDUA ROLE BISA MELIHAT) */}
              <div className="space-y-2 pt-4 border-t border-gray-100">
                <label className="font-bold text-gray-500 uppercase block tracking-wider text-[10px]">Riwayat Berkas & Catatan Log</label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {selectedItem.submission_logs && selectedItem.submission_logs.length > 0 ? (
                    selectedItem.submission_logs.map((log) => (
                      <div key={log.id} className="bg-gray-50 p-2 rounded border border-gray-100 text-[11px]">
                        <p className="text-gray-700 font-medium">{log.note}</p>
                        <span className="text-[9px] text-gray-400 block mt-0.5">
                          {new Date(log.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-400 italic text-[11px]">Belum ada log aktivitas untuk berkas ini.</p>
                  )}
                </div>
              </div>
            </div>

            {/* PANEL FOOTER ACTION BUTTONS */}
            {userRole === 'sa' && (
              <div className="pt-4 border-t border-gray-200 flex gap-2 mt-4">
                <button onClick={() => setSelectedItem(null)} className="flex-1 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition-colors text-xs">Tutup</button>
                <button onClick={handleSaveChanges} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors text-xs shadow-md">Simpan & Kirim WA</button>
              </div>
            )}

            {userRole === 'request' && !isEditMode && (
              <button onClick={() => setSelectedItem(null)} className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors text-xs mt-4">Tutup Detail</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}