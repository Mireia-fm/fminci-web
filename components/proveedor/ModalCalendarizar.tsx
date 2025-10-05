import { PALETA } from "@/lib/theme";
import SearchableSelect from "@/components/SearchableSelect";

interface ModalCalendarizarProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  fechaVisita: string;
  setFechaVisita: (value: string) => void;
  horarioVisita: string;
  setHorarioVisita: (value: string) => void;
  enviando: boolean;
}

export default function ModalCalendarizar({
  isOpen,
  onClose,
  onSubmit,
  fechaVisita,
  setFechaVisita,
  horarioVisita,
  setHorarioVisita,
  enviando
}: ModalCalendarizarProps) {
  if (!isOpen) return null;

  const handleClose = () => {
    setFechaVisita('');
    setHorarioVisita('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className="rounded-lg p-8 max-w-md w-full mx-4 shadow"
        style={{ backgroundColor: PALETA.card }}
      >
        <h3 className="text-xl font-semibold mb-6" style={{ color: PALETA.textoOscuro }}>
          Calendarizar Visita
        </h3>

        <div className="space-y-6">
          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
              Fecha de la visita *
            </label>
            <input
              type="date"
              value={fechaVisita}
              onChange={(e) => setFechaVisita(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full h-9 rounded border px-3 text-sm outline-none"
              onFocus={(e) => {
                e.target.style.borderColor = PALETA.verdeClaro;
                e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}40`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '';
                e.target.style.boxShadow = '';
              }}
              required
            />
          </div>

          {/* Horario */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
              Horario *
            </label>
            <SearchableSelect
              value={horarioVisita}
              onChange={(value) => setHorarioVisita(value)}
              options={[
                { value: "mañana", label: "Horario de mañana" },
                { value: "tarde", label: "Horario de tarde" }
              ]}
              placeholder="Seleccione un horario"
              focusColor={PALETA.verdeClaro}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm rounded border hover:bg-gray-50 transition-colors"
            style={{ color: PALETA.textoOscuro, borderColor: '#d1d5db' }}
            disabled={enviando}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!fechaVisita || !horarioVisita || enviando}
            className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#7A8A6F' }}
          >
            {enviando ? 'Calendarizando...' : 'Calendarizar Visita'}
          </button>
        </div>
      </div>
    </div>
  );
}
