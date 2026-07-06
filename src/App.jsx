// src/App.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';

export default function App() {
  const [activeTab, setActiveTab] = useState('on_progress'); // on_progress atau done
  const [submissions, setSubmissions] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Ambil data dari Supabase saat komponen pertama kali dimuat atau tab berubah
  useEffect(() => {
    fetchSubmissions();
  }, [activeTab]);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      // Filter data: jika tab 'done', ambil yang is_cair = true. Jika 'on_progress', ambil yang false.
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
      alert('Terjadi kesalahan saat memuat data anggaran.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Fungsi untuk menyimpan perubahan status/RF/pencairan ke Supabase
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

      const { error } = await supabase
        .from('submissions')
        .update(updates)
        .eq('id', selectedItem.id);

      if (error) throw error;

      alert('Data berhasil diperbarui!');
      setSelectedItem(null);
      fetchSubmissions(); // Refresh data tabel
    } catch (error) {
      console.error('Gagal memperbarui data:', error.message);
      alert('Gagal menyimpan perubahan.');
    }
  };

  const formatRupiah = (num) => {
    if (!num) return 'Rp 0';
    return 'Rp ' + Number(num).toLocaleString('id-ID');
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#334155] font-sans antialiased">
      {/* Navbar / Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">SA</div>
          <h1 className="text-lg font-semibold tracking-tight text-gray-900">Finance Tracker</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-600">Kak Dinda</span>
          <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-xs text-indigo-600">D</div>
        </div>
      </header>

      {/* Konten Utama */}
      <main className="max-w-7xl mx-auto px-8 py-8">
        {/* Tab Switcher */}
        <div className="flex border-b border-gray-200 mb-6 gap-2">
          <button 
            onClick={() => setActiveTab('on_progress')}
            className={`px-5 py-2.5 font-medium text-sm transition-all border-b-2 ${activeTab === 'on_progress' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            On Progress
          </button>
          <button 
            onClick={() => setActiveTab('done')}
            className={`px-5 py-2.5 font-medium text-sm transition-all border-b-2 ${activeTab === 'done' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Done Pencairan
          </button>
        </div>

        {/* Tabel Data */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-sm text-gray-400">Memuat data dari database...</div>
          ) : submissions.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-400">Tidak ada pengajuan di tab ini.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8F9FA] border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-4">ORMAWA</th>
                  <th className="px-6 py-4">Nama Kegiatan</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Nominal</th>
                  <th className="px-6 py-4">Nomor RF</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {submissions.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{item.ormawa}</td>
                    <td className="px-6 py-4 text-gray-600">{item.nama_kegiatan}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        item.status_proposal === 'Diterima' ? 'bg-[#E6F4EA] text-[#137333]' : 
                        item.status_proposal === 'Need Revision' ? 'bg-[#FEF7E0] text-[#B06000]' : 'bg-[#FCE8E6] text-[#C5221F]'
                      }`}>
                        {item.status_proposal}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-600">{formatRupiah(item.nominal_pengajuan)}</td>
                    <td className="px-6 py-4 text-gray-500 font-mono text-xs">{item.nomor_rf || '—'}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedItem(item)}
                        className="text-sm text-indigo-600 hover:text-indigo-900 font-medium px-3 py-1 rounded-md hover:bg-indigo-50 transition-colors"
                      >
                        Kelola
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Slide-Over Panel (Laci Kanan) */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          <div className="absolute inset-0 bg-gray-900/20 backdrop-blur-xs transition-opacity" onClick={() => setSelectedItem(null)} />
          
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-gray-200">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-[#F8F9FA]">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{selectedItem.ormawa}</span>
                <h3 className="text-base font-semibold text-gray-900">{selectedItem.nama_kegiatan}</h3>
              </div>
              <button onClick={() => setSelectedItem(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl text-xs border border-gray-100">
                <div><span className="text-gray-400 block">BPH / CP</span> <strong className="text-gray-700">{selectedItem.bph_kegiatan} ({selectedItem.cp_bph})</strong></div>
                <div><span className="text-gray-400 block">PIC Pembina</span> <strong className="text-gray-700">{selectedItem.pic_pembina}</strong></div>
              </div>

              {/* Pilihan Status */}
              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block">Update Status Proposal/LPJ</label>
                <div className="flex gap-2">
                  {['Diterima', 'Need Revision', 'Reject'].map((st) => (
                    <button 
                      key={st}
                      onClick={() => setSelectedItem({...selectedItem, status_proposal: st})}
                      className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all ${
                        selectedItem.status_proposal === st 
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 font-semibold' 
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Kondisional Input Deadline */}
              {selectedItem.status_proposal === 'Need Revision' && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block">Deadline Revisi</label>
                  <input 
                    type="date" 
                    value={selectedItem.deadline_revisi || ''} 
                    onChange={(e) => setSelectedItem({...selectedItem, deadline_revisi: e.target.value})}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2.5 focus:outline-hidden focus:ring-1 focus:ring-indigo-500" 
                  />
                </div>
              )}

              {/* Input Nomor RF */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block">Nomor RF (CIS)</label>
                  <input 
                    type="text" 
                    value={selectedItem.nomor_rf || ''} 
                    onChange={(e) => setSelectedItem({...selectedItem, nomor_rf: e.target.value})}
                    placeholder="Contoh: UC/SA/2025-2026/00390"
                    className="w-full font-mono text-sm border border-gray-200 rounded-lg p-2.5 focus:outline-hidden focus:ring-1 focus:ring-indigo-500" 
                  />
                </div>

                {/* Checkbox Pencairan */}
                <div className="flex items-start gap-3 bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-100 mt-2">
                  <input 
                    type="checkbox" 
                    id="is_cair" 
                    checked={selectedItem.is_cair || false}
                    onChange={(e) => setSelectedItem({...selectedItem, is_cair: e.target.checked})}
                    className="mt-0.5 rounded-sm border-gray-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <label htmlFor="is_cair" className="text-xs text-emerald-800 leading-tight">
                    <strong className="block font-semibold mb-0.5">Sudah Dicairkan ke Mahasiswa</strong>
                    Mencentang ini akan memindahkan data dari tab "On Progress" ke tab "Done".
                  </label>
                </div>
              </div>
            </div>

            {/* Tombol Aksi Panel */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex gap-2">
              <button onClick={() => setSelectedItem(null)} className="flex-1 py-2.5 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">Batal</button>
              <button 
                onClick={handleSaveChanges} 
                className="flex-1 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-xs transition-colors"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}