
import React, { useState, useEffect, useMemo } from 'react';
import { dbService } from '../services/dbService';
import { Client } from '../types';
import { Users, Plus, Phone, Mail, DollarSign, Search, Edit2, Trash2, X, AlertTriangle, Loader2, UserPlus } from 'lucide-react';

const ClientsView: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchClients = async () => {
    try {
      const data = await dbService.getClients();
      setClients(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const filteredClients = useMemo(() => {
    return clients.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm)
    );
  }, [clients, searchTerm]);

  const handleSaveClient = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const clientData: Partial<Client> = {
      id: editingClient?.id,
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      currentDebt: editingClient?.currentDebt || 0
    };
    
    try {
      await dbService.saveClient(clientData);
      await fetchClients();
      setIsModalOpen(false);
      setEditingClient(null);
    } catch (err) {
      alert("Error al guardar cliente");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteClient = async () => {
    if (!clientToDelete) return;
    setLoading(true);
    try {
      await dbService.deleteClient(clientToDelete.id);
      await fetchClients();
      setIsDeleteModalOpen(false);
      setClientToDelete(null);
    } catch (err) {
      alert("No se pudo eliminar el cliente. Verifique si tiene facturas asociadas.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setIsModalOpen(true);
  };

  const openDeleteModal = (client: Client) => {
    setClientToDelete(client);
    setIsDeleteModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Gestión de Clientes</h1>
          <p className="text-slate-500 font-medium">Base de datos centralizada de compradores y deudores.</p>
        </div>
        <button 
          onClick={() => { setEditingClient(null); setIsModalOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-blue-100 transition-all active:scale-95"
        >
          <Plus size={20} /> Nuevo Cliente
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text" 
          placeholder="Buscar clientes por nombre o teléfono..." 
          className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map(client => (
          <div key={client.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-xl hover:shadow-2xl transition-all group relative overflow-hidden">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-black text-2xl shadow-inner">
                {client.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-slate-800 text-lg truncate">{client.name}</h3>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Socio Comercial</p>
              </div>
            </div>
            
            <div className="space-y-3 text-sm text-slate-600 mb-8">
              <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl">
                <Phone size={16} className="text-blue-400" />
                <span className="font-bold text-slate-700">{client.phone || 'Sin teléfono'}</span>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl">
                <Mail size={16} className="text-blue-400" />
                <span className="font-bold text-slate-700 truncate">{client.email || 'Sin correo'}</span>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Deuda Actual</p>
                <p className={`text-xl font-black ${client.currentDebt > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                  ${client.currentDebt.toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <Users className="text-slate-300" size={20} />
              </div>
            </div>

            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => openEditModal(client)}
                className="p-2 text-blue-500 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all shadow-sm"
                title="Editar cliente"
              >
                <Edit2 size={16} />
              </button>
              <button 
                onClick={() => openDeleteModal(client)}
                className="p-2 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shadow-sm"
                title="Eliminar cliente"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {filteredClients.length === 0 && (
          <div className="col-span-full py-24 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-100">
            <Users size={64} className="mx-auto text-slate-100 mb-4" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No se encontraron clientes</p>
          </div>
        )}
      </div>

      {/* Modal Crear/Editar Cliente */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <form onSubmit={handleSaveClient} className="relative bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">
                  {editingClient ? 'Modificar Cliente' : 'Nuevo Cliente'}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Información de contacto (Opcional)</p>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-300 hover:text-slate-600 transition-all">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Completo *</label>
                <input 
                  name="name" 
                  defaultValue={editingClient?.name} 
                  required 
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" 
                  placeholder="Ej: Juan Pérez"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Número de Teléfono</label>
                <input 
                  name="phone" 
                  defaultValue={editingClient?.phone} 
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" 
                  placeholder="Ej: 0412-1234567"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Correo Electrónico</label>
                <input 
                  name="email" 
                  type="email" 
                  defaultValue={editingClient?.email} 
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" 
                  placeholder="ejemplo@correo.com"
                />
              </div>
            </div>

            <button disabled={loading} type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white py-5 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="animate-spin" /> : (editingClient ? 'Guardar Cambios' : 'Registrar Cliente')}
            </button>
          </form>
        </div>
      )}

      {/* Modal de Confirmación de Borrado */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsDeleteModalOpen(false)} />
          <div className="relative bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl text-center animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
              <AlertTriangle size={40} />
            </div>
            
            <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">¿Eliminar Cliente?</h3>
            <p className="text-slate-500 font-medium mb-6 leading-relaxed">
              Estás a punto de borrar a <span className="font-black text-slate-800">"{clientToDelete?.name}"</span>. <br/>
              Esta acción eliminará su registro de contacto de forma permanente.
            </p>

            <div className="flex flex-col gap-3">
              <button 
                onClick={confirmDeleteClient}
                disabled={loading}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-rose-100 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Confirmar Eliminación'}
              </button>
              <button 
                onClick={() => { setIsDeleteModalOpen(false); setClientToDelete(null); }}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientsView;
