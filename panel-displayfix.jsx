import { useState, useEffect, useRef } from "react";
import { Plus, Pencil, Check, TicketPercent, ArrowLeft, ArrowRight, LayoutGrid, Trash2, ScanLine, Printer, Camera, X, FileBarChart } from "lucide-react";

const initialProducts = [
  { id: 1, nombre: "Funda", costo: 1200, precio: 3500, stock: 18, codigo: "DF00001" },
  { id: 2, nombre: "Vidrio templado", costo: 800, precio: 2500, stock: 25, codigo: "DF00002" },
  { id: 3, nombre: "Batería", costo: 9500, precio: 22000, stock: 6, codigo: "DF00003" },
  { id: 4, nombre: "Módulo pantalla", costo: 45000, precio: 78000, stock: 3, codigo: "DF00004" },
  { id: 5, nombre: "Pin de carga", costo: 2200, precio: 6000, stock: 12, codigo: "DF00005" },
];

const initialGastoTiles = [
  { id: 1, nombre: "Desayuno", monto: 11000 },
  { id: 2, nombre: "Almuerzo", monto: 20000 },
  { id: 3, nombre: "Compra de repuestos", monto: 0 },
  { id: 4, nombre: "Compra de fundas", monto: 0 },
];

function money(n) {
  return "$" + Number(n).toLocaleString("es-AR");
}

function barcodeUrl(codigo) {
  return `https://barcodeapi.org/api/128/${encodeURIComponent(codigo)}`;
}

export default function PanelDisplayfix() {
  const [tab, setTab] = useState("venta");
  const [products, setProducts] = useState(initialProducts);
  const [ticket, setTicket] = useState([]);
  const [confirming, setConfirming] = useState(null); // product being sold
  const [confirmPrice, setConfirmPrice] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newDraft, setNewDraft] = useState({ nombre: "", costo: "", porcentaje: "100", precio: "", stock: "" });
  const [organizando, setOrganizando] = useState(false);
  const [labelProduct, setLabelProduct] = useState(null);
  const [scanMsg, setScanMsg] = useState("");
  const [scanTest, setScanTest] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [cierreInfo, setCierreInfo] = useState(null);
  const [ultimoCierre, setUltimoCierre] = useState(null);
  const [gastos, setGastos] = useState([]);
  const [addingGasto, setAddingGasto] = useState(false);
  const [gastoDraft, setGastoDraft] = useState({ concepto: "", monto: "" });
  const [gastoTiles, setGastoTiles] = useState(initialGastoTiles);
  const [confirmGasto, setConfirmGasto] = useState(null);
  const [confirmGastoMonto, setConfirmGastoMonto] = useState("");
  const [addingGastoTile, setAddingGastoTile] = useState(false);
  const [newGastoTileDraft, setNewGastoTileDraft] = useState({ nombre: "", monto: "" });

  function openConfirmGasto(tile) {
    setConfirmGasto(tile);
    setConfirmGastoMonto(tile.monto ? String(tile.monto) : "");
  }

  function registrarGastoTile() {
    const monto = Number(confirmGastoMonto) || 0;
    if (!monto) return;
    setGastos([{ id: Date.now(), concepto: confirmGasto.nombre, monto, fecha: new Date().toLocaleDateString("es-AR") }, ...gastos]);
    setGastoTiles(gastoTiles.map((t) => (t.id === confirmGasto.id ? { ...t, monto } : t)));
    setConfirmGasto(null);
  }

  function addGastoTile() {
    if (!newGastoTileDraft.nombre.trim()) return;
    setGastoTiles([...gastoTiles, { id: Date.now(), nombre: newGastoTileDraft.nombre, monto: Number(newGastoTileDraft.monto) || 0 }]);
    setNewGastoTileDraft({ nombre: "", monto: "" });
    setAddingGastoTile(false);
  }

  function addGasto() {
    if (!gastoDraft.concepto.trim() || !Number(gastoDraft.monto)) return;
    setGastos([
      { id: Date.now(), concepto: gastoDraft.concepto, monto: Number(gastoDraft.monto), fecha: new Date().toLocaleDateString("es-AR") },
      ...gastos,
    ]);
    setGastoDraft({ concepto: "", monto: "" });
    setAddingGasto(false);
  }

  function deleteGasto(id) {
    setGastos(gastos.filter((g) => g.id !== id));
  }

  function handleScan(codigo) {
    const limpio = codigo.trim();
    if (!limpio) return;
    const producto = products.find((p) => p.codigo === limpio);
    if (producto) {
      setTab("venta");
      openConfirm(producto);
      setScanMsg(`✓ Escaneado: ${producto.nombre}`);
    } else {
      setScanMsg(`Código no reconocido: ${limpio}`);
    }
    setTimeout(() => setScanMsg(""), 3000);
  }

  // --- Escaneo con cámara del celular (sin lector aparte) ---
  async function abrirCamara() {
    setCameraError("");
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (!("BarcodeDetector" in window)) {
        setCameraError("Este navegador no tiene lector de códigos incorporado (funciona en Chrome para Android). Probá con el simulador de abajo mientras tanto.");
        return;
      }
      const detector = new window.BarcodeDetector({ formats: ["code_128", "ean_13", "qr_code"] });
      const loop = async () => {
        if (!videoRef.current) return;
        try {
          const codigos = await detector.detect(videoRef.current);
          if (codigos.length > 0) {
            cerrarCamara();
            handleScan(codigos[0].rawValue);
            return;
          }
        } catch (err) {
          // sigue intentando
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (err) {
      setCameraError("No se pudo acceder a la cámara. En esta vista previa de Claude puede estar bloqueada por seguridad; en la app final, con los permisos normales del celular, va a funcionar.");
    }
  }

  function cerrarCamara() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  // --- Cierre de caja diario ---
  function cerrarCaja(automatico) {
    const hoy = new Date().toLocaleDateString("es-AR");
    const totalVentas = ticket.reduce((acc, t) => acc + t.precio, 0);
    const totalGanancia = ticket.reduce((acc, t) => acc + t.ganancia, 0);
    const gastosHoy = gastos.filter((g) => g.fecha === hoy).reduce((acc, g) => acc + g.monto, 0);
    setCierreInfo({ fecha: hoy, cantidad: ticket.length, totalVentas, totalGanancia, gastosHoy, gananciaNeta: totalGanancia - gastosHoy, automatico });
    setUltimoCierre(hoy);
    setTicket([]);
  }

  // Chequea cada 30s si llegó la hora del cierre (17:15). Esto solo funciona con la app abierta;
  // para que se dispare aunque el celular esté cerrado, lo ideal es que lo haga el backend (el bot de WhatsApp en Render).
  useEffect(() => {
    const interval = setInterval(() => {
      const ahora = new Date();
      const hoy = ahora.toLocaleDateString("es-AR");
      if (ahora.getHours() === 17 && ahora.getMinutes() === 15 && ultimoCierre !== hoy) {
        cerrarCaja(true);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [ticket, ultimoCierre]);
  // Escucha teclas: los lectores de código de barra USB/Bluetooth escriben rápido y mandan Enter al final,
  // igual que un teclado. Así detectamos un escaneo real sin necesidad de cámara.
  useEffect(() => {
    let buffer = "";
    let lastTime = Date.now();
    function onKeyDown(e) {
      if (confirming || adding || editingId || labelProduct) return;
      const now = Date.now();
      if (now - lastTime > 300) buffer = "";
      lastTime = now;
      if (e.key === "Enter") {
        if (buffer.length >= 3) handleScan(buffer);
        buffer = "";
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [products, confirming, adding, editingId, labelProduct]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function actualizarDesdeCosto(valor) {
    const costo = Number(valor) || 0;
    const pct = Number(newDraft.porcentaje) || 0;
    setNewDraft((d) => ({ ...d, costo: valor, precio: costo > 0 ? String(Math.round(costo * (1 + pct / 100))) : "" }));
  }

  function actualizarDesdePorcentaje(valor) {
    setNewDraft((d) => {
      const costo = Number(d.costo) || 0;
      const pct = Number(valor) || 0;
      return { ...d, porcentaje: valor, precio: costo > 0 ? String(Math.round(costo * (1 + pct / 100))) : "" };
    });
  }

  function actualizarDesdePrecio(valor) {
    setNewDraft((d) => {
      const costo = Number(d.costo) || 0;
      const precio = Number(valor) || 0;
      const pct = costo > 0 ? Math.round(((precio - costo) / costo) * 100) : Number(d.porcentaje) || 0;
      return { ...d, precio: valor, porcentaje: String(pct) };
    });
  }

  function moverProducto(index, direccion) {
    const destino = index + direccion;
    if (destino < 0 || destino >= products.length) return;
    const copia = [...products];
    [copia[index], copia[destino]] = [copia[destino], copia[index]];
    setProducts(copia);
  }

  function openConfirm(p) {
    setConfirming(p);
    setConfirmPrice(String(p.precio));
  }

  function registrarVenta() {
    const precioFinal = Number(confirmPrice) || confirming.precio;
    const ganancia = precioFinal - confirming.costo;
    setTicket([
      { id: Date.now(), nombre: confirming.nombre, precio: precioFinal, ganancia, hora: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) },
      ...ticket,
    ]);
    setProducts(products.map((p) => (p.id === confirming.id ? { ...p, stock: Math.max(0, p.stock - 1) } : p)));
    setConfirming(null);
  }

  function startEdit(p) {
    setEditingId(p.id);
    const pct = p.costo > 0 ? Math.round(((p.precio - p.costo) / p.costo) * 100) : 0;
    setEditDraft({ nombre: p.nombre, costo: String(p.costo), porcentaje: String(pct), precio: String(p.precio), stock: String(p.stock) });
    setConfirmDelete(false);
  }

  function editDesdeCosto(valor) {
    setEditDraft((d) => {
      const costo = Number(valor) || 0;
      const pct = Number(d.porcentaje) || 0;
      return { ...d, costo: valor, precio: costo > 0 ? String(Math.round(costo * (1 + pct / 100))) : d.precio };
    });
  }

  function editDesdePorcentaje(valor) {
    setEditDraft((d) => {
      const costo = Number(d.costo) || 0;
      const pct = Number(valor) || 0;
      return { ...d, porcentaje: valor, precio: costo > 0 ? String(Math.round(costo * (1 + pct / 100))) : d.precio };
    });
  }

  function editDesdePrecio(valor) {
    setEditDraft((d) => {
      const costo = Number(d.costo) || 0;
      const precio = Number(valor) || 0;
      const pct = costo > 0 ? Math.round(((precio - costo) / costo) * 100) : Number(d.porcentaje) || 0;
      return { ...d, precio: valor, porcentaje: String(pct) };
    });
  }

  function saveEdit() {
    setProducts(products.map((p) => (p.id === editingId ? { ...p, nombre: editDraft.nombre, costo: Number(editDraft.costo) || 0, precio: Number(editDraft.precio) || 0, stock: Number(editDraft.stock) || 0 } : p)));
    setEditingId(null);
  }

  function deleteProduct() {
    setProducts(products.filter((p) => p.id !== editingId));
    setEditingId(null);
    setConfirmDelete(false);
  }

  function addProduct() {
    if (!newDraft.nombre.trim()) return;
    const id = Date.now();
    const nuevo = {
      id,
      nombre: newDraft.nombre,
      costo: Number(newDraft.costo) || 0,
      precio: Number(newDraft.precio) || 0,
      stock: Number(newDraft.stock) || 0,
      codigo: "DF" + String(id).slice(-6),
    };
    setProducts([...products, nuevo]);
    setNewDraft({ nombre: "", costo: "", porcentaje: "100", precio: "", stock: "" });
    setAdding(false);
    setLabelProduct(nuevo);
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#15171B", minHeight: "100vh", color: "#FAF8F3" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
        .mono { font-family: 'IBM Plex Mono', monospace; }
        .display { font-family: 'Space Grotesk', sans-serif; }
        .tile {
          background: #FAF8F3;
          color: #1F2023;
          border-radius: 12px;
          padding: 10px 9px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 64px;
          cursor: pointer;
          border: 1px solid transparent;
          transition: transform .12s ease, box-shadow .12s ease;
          box-shadow: 0 1px 0 rgba(0,0,0,0.04);
        }
        .tile:active { transform: scale(0.97); }
        .tile:hover { box-shadow: 0 4px 14px rgba(0,0,0,0.18); }
        .ticket-row {
          display: flex;
          justify-content: space-between;
          padding: 7px 0;
          border-bottom: 1px dashed #3A3D44;
          font-size: 13px;
        }
        .perforate {
          height: 10px;
          background-image: radial-gradient(circle, #15171B 4px, transparent 4.5px);
          background-size: 16px 10px;
          background-position: 4px 0;
        }
        .tab-btn {
          flex: 1;
          padding: 10px 0;
          text-align: center;
          font-weight: 600;
          font-size: 14px;
          border-radius: 10px;
          cursor: pointer;
        }
        input[type=text], input[type=number] {
          background: #fff;
          border: 1px solid #D8D4CB;
          border-radius: 8px;
          padding: 6px 8px;
          color: #1F2023;
          font-size: 13px;
          width: 100%;
        }
        .move-btn {
          background: #1F2023;
          color: #FAF8F3;
          border: none;
          border-radius: 6px;
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .move-btn:disabled { opacity: 0.25; cursor: default; }
        @media print {
          body * { visibility: hidden; }
          #etiqueta-imprimir, #etiqueta-imprimir * { visibility: visible; }
          #etiqueta-imprimir { position: absolute; top: 0; left: 0; width: 100%; }
        }
      `}</style>

      <div style={{ maxWidth: 420, margin: "0 auto", padding: "20px 16px 40px" }}>
        {/* Header */}
        <div style={{ marginBottom: 18 }}>
          <div className="display" style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>Displayfix</div>
          <div style={{ fontSize: 12, color: "#9A9DA5", marginTop: 2 }}>Panel de ventas e inventario</div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, background: "#1F2228", padding: 4, borderRadius: 12, marginBottom: 18 }}>
          <div
            className="tab-btn"
            style={{ background: tab === "venta" ? "#FF7A30" : "transparent", color: tab === "venta" ? "#15171B" : "#9A9DA5" }}
            onClick={() => setTab("venta")}
          >
            Venta rápida
          </div>
          <div
            className="tab-btn"
            style={{ background: tab === "stock" ? "#FF7A30" : "transparent", color: tab === "stock" ? "#15171B" : "#9A9DA5" }}
            onClick={() => setTab("stock")}
          >
            Stock
          </div>
          <div
            className="tab-btn"
            style={{ background: tab === "gastos" ? "#FF7A30" : "transparent", color: tab === "gastos" ? "#15171B" : "#9A9DA5" }}
            onClick={() => setTab("gastos")}
          >
            Gastos
          </div>
        </div>

        {/* Franja de escáner — siempre visible, sea cual sea el tab */}
        <div style={{ background: "#1F2228", borderRadius: 12, padding: "10px 12px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: scanMsg ? 8 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#5FB88A", fontWeight: 600 }}>
              <ScanLine size={14} /> Escáner listo
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => {
                  const hoy = new Date().toLocaleDateString("es-AR");
                  const gastosHoy = gastos.filter((g) => g.fecha === hoy).reduce((a, g) => a + g.monto, 0);
                  const totalGanancia = ticket.reduce((a, t) => a + t.ganancia, 0);
                  setCierreInfo({ fecha: hoy, cantidad: ticket.length, totalVentas: ticket.reduce((a, t) => a + t.precio, 0), totalGanancia, gastosHoy, gananciaNeta: totalGanancia - gastosHoy, automatico: false });
                }}
                style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, background: "transparent", color: "#9A9DA5", border: "1px solid #3A3D44", borderRadius: 8, padding: "6px 9px", cursor: "pointer" }}
              >
                <FileBarChart size={13} /> Cerrar caja
              </button>
              <button
                onClick={abrirCamara}
                style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, background: "#FF7A30", color: "#15171B", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}
              >
                <Camera size={13} /> Escanear
              </button>
            </div>
          </div>

          {scanMsg && (
            <div style={{ background: scanMsg.startsWith("✓") ? "#1F3B30" : "#3B1F1F", color: scanMsg.startsWith("✓") ? "#5FB88A" : "#E5848A", borderRadius: 8, padding: "7px 10px", fontSize: 12, marginBottom: 8 }}>
              {scanMsg}
            </div>
          )}

          <div style={{ fontSize: 10, color: "#6E7178", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>
            Lector USB/Bluetooth: listo automáticamente. Probar a mano (solo en esta vista previa):
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="text"
              placeholder="Ej: DF00001"
              value={scanTest}
              onChange={(e) => setScanTest(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { handleScan(scanTest); setScanTest(""); } }}
              style={{ background: "#15171B", color: "#FAF8F3", border: "1px solid #3A3D44" }}
            />
            <button
              onClick={() => { handleScan(scanTest); setScanTest(""); }}
              style={{ background: "#2A2D33", color: "#FAF8F3", border: "none", borderRadius: 8, padding: "0 14px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
            >
              Ir
            </button>
          </div>
        </div>

        {tab === "venta" && (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <button
                onClick={() => setOrganizando(!organizando)}
                style={{
                  display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600,
                  background: organizando ? "#FF7A30" : "#1F2228", color: organizando ? "#15171B" : "#9A9DA5",
                  border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer",
                }}
              >
                <LayoutGrid size={13} /> {organizando ? "Listo" : "Organizar"}
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 22 }}>
              {products.map((p, i) => {
                const critico = p.stock <= 2;
                const bajo = p.stock <= 5 && !critico;
                return (
                  <div key={p.id} className="tile" onClick={() => !organizando && openConfirm(p)} style={{ cursor: organizando ? "default" : "pointer" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 12.5, lineHeight: 1.2 }}>{p.nombre}</div>
                      <div style={{ fontSize: 10.5, color: critico ? "#E5484D" : bajo ? "#FF7A30" : "#9A9DA5", marginTop: 2, fontWeight: critico ? 700 : 400 }}>
                        Stock: {p.stock}
                      </div>
                    </div>
                    {organizando ? (
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                        <button className="move-btn" disabled={i === 0} onClick={(e) => { e.stopPropagation(); moverProducto(i, -1); }}><ArrowLeft size={12} /></button>
                        <button className="move-btn" disabled={i === products.length - 1} onClick={(e) => { e.stopPropagation(); moverProducto(i, 1); }}><ArrowRight size={12} /></button>
                      </div>
                    ) : (
                      <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: "#1F2023", marginTop: 6 }}>
                        {money(p.precio)}
                      </div>
                    )}
                  </div>
                );
              })}
              <div
                className="tile"
                style={{ alignItems: "center", justifyContent: "center", border: "1.5px dashed #555861", background: "transparent", color: "#9A9DA5" }}
                onClick={() => setAdding(true)}
              >
                <Plus size={16} />
                <div style={{ fontSize: 10.5, marginTop: 3 }}>Agregar</div>
              </div>
            </div>

            {/* Ticket / register tape */}
            <div style={{ background: "#1F2228", borderRadius: 14, overflow: "hidden" }}>
              <div className="perforate" />
              <div style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: "#9A9DA5", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>
                  <TicketPercent size={13} /> Ventas de hoy
                </div>
                {ticket.length === 0 && (
                  <div style={{ fontSize: 12.5, color: "#6E7178", padding: "8px 0" }}>Tocá un producto arriba para registrar la primera venta.</div>
                )}
                {ticket.map((t) => (
                  <div key={t.id} className="ticket-row">
                    <span>{t.hora} · {t.nombre}</span>
                    <span className="mono">
                      {money(t.precio)} <span style={{ color: "#3FB68B" }}>(+{money(t.ganancia)})</span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="perforate" />
            </div>
          </>
        )}

        {tab === "stock" && (
          <div style={{ background: "#1F2228", borderRadius: 14, padding: 6 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.8fr 0.8fr 0.8fr 0.6fr 24px 24px", gap: 4, fontSize: 10.5, color: "#9A9DA5", padding: "8px 8px 6px", textTransform: "uppercase", letterSpacing: 0.4 }}>
              <span>Producto</span><span>Costo</span><span>Precio</span><span>Ganancia</span><span>Stock</span><span></span><span></span>
            </div>
            {products.map((p) => (
              <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1.3fr 0.8fr 0.8fr 0.8fr 0.6fr 24px 24px", gap: 4, padding: "9px 8px", alignItems: "center", borderTop: "1px solid #2A2D33", fontSize: 13 }}>
                <span style={{ fontWeight: 500 }}>{p.nombre}</span>
                <span className="mono" style={{ fontSize: 12, color: "#9A9DA5" }}>{money(p.costo)}</span>
                <span className="mono" style={{ fontSize: 12 }}>{money(p.precio)}</span>
                <span className="mono" style={{ fontSize: 12, color: "#3FB68B" }}>{money(p.precio - p.costo)}</span>
                <span className="mono" style={{ fontSize: 12, fontWeight: p.stock <= 2 ? 700 : 400, color: p.stock <= 2 ? "#E5484D" : p.stock <= 5 ? "#FF7A30" : "#FAF8F3" }}>{p.stock}</span>
                <button onClick={() => setLabelProduct(p)} style={{ background: "none", border: "none", color: "#9A9DA5", cursor: "pointer" }}><Printer size={14} /></button>
                <button onClick={() => startEdit(p)} style={{ background: "none", border: "none", color: "#9A9DA5", cursor: "pointer" }}><Pencil size={14} /></button>
              </div>
            ))}
            <div style={{ padding: 8 }}>
              <button
                onClick={() => setAdding(true)}
                style={{ width: "100%", background: "transparent", border: "1.5px dashed #555861", color: "#9A9DA5", borderRadius: 10, padding: "9px 0", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <Plus size={14} /> Agregar producto
              </button>
            </div>
          </div>
        )}

        {tab === "gastos" && (
          <div style={{ background: "#1F2228", borderRadius: 14, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: "#9A9DA5", textTransform: "uppercase", letterSpacing: 0.4 }}>Total gastado</span>
              <span className="mono" style={{ fontSize: 17, fontWeight: 700, color: "#E5484D" }}>{money(gastos.reduce((a, g) => a + g.monto, 0))}</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
              {gastoTiles.map((t) => (
                <div key={t.id} className="tile" onClick={() => openConfirmGasto(t)}>
                  <div style={{ fontWeight: 600, fontSize: 12, lineHeight: 1.2 }}>{t.nombre}</div>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: "#1F2023", marginTop: 6 }}>
                    {t.monto ? money(t.monto) : "Tocar"}
                  </div>
                </div>
              ))}
              <div
                className="tile"
                style={{ alignItems: "center", justifyContent: "center", border: "1.5px dashed #555861", background: "transparent", color: "#9A9DA5" }}
                onClick={() => setAddingGastoTile(true)}
              >
                <Plus size={16} />
                <div style={{ fontSize: 10.5, marginTop: 3 }}>Agregar</div>
              </div>
            </div>

            <div style={{ fontSize: 10, color: "#6E7178", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>Historial</div>
            {gastos.length === 0 && (
              <div style={{ fontSize: 12.5, color: "#6E7178", padding: "10px 0" }}>Todavía no cargaste ningún gasto. Tocá uno de los mosaicos de arriba.</div>
            )}

            {gastos.map((g) => (
              <div key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 4px", borderTop: "1px solid #2A2D33", fontSize: 13 }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{g.concepto}</div>
                  <div style={{ fontSize: 10.5, color: "#6E7178" }}>{g.fecha}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="mono" style={{ fontSize: 13 }}>{money(g.monto)}</span>
                  <button onClick={() => deleteGasto(g.id)} style={{ background: "none", border: "none", color: "#9A9DA5", cursor: "pointer" }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}

            <div style={{ marginTop: 12 }}>
              <button
                onClick={() => setAddingGasto(true)}
                style={{ width: "100%", background: "transparent", border: "1.5px dashed #555861", color: "#9A9DA5", borderRadius: 10, padding: "9px 0", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <Plus size={14} /> Gasto puntual (sin guardar mosaico)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm sale modal */}
      {confirming && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setConfirming(null)}>
          <div style={{ background: "#FAF8F3", color: "#1F2023", width: "100%", maxWidth: 420, borderRadius: "18px 18px 0 0", padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div className="display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Vender {confirming.nombre}</div>
            <div style={{ fontSize: 12, color: "#7A7D85", marginBottom: 14 }}>Precio predeterminado: {money(confirming.precio)}. Editalo si vendiste a otro valor.</div>
            <label style={{ fontSize: 11, color: "#7A7D85", textTransform: "uppercase" }}>Precio de venta</label>
            <input type="number" value={confirmPrice} onChange={(e) => setConfirmPrice(e.target.value)} style={{ fontSize: 18, padding: "10px 12px", marginTop: 4, marginBottom: 14 }} className="mono" />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirming(null)} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid #D8D4CB", background: "none", color: "#1F2023", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button onClick={registrarVenta} style={{ flex: 2, padding: "12px 0", borderRadius: 10, border: "none", background: "#FF7A30", color: "#15171B", fontWeight: 700, cursor: "pointer" }}>Registrar venta</button>
            </div>
          </div>
        </div>
      )}

      {/* Add product modal */}
      {adding && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setAdding(false)}>
          <div style={{ background: "#FAF8F3", color: "#1F2023", width: "100%", maxWidth: 420, borderRadius: "18px 18px 0 0", padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div className="display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>Nuevo producto</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 8 }}>
              <input type="text" placeholder="Nombre (ej: Cable USB-C)" value={newDraft.nombre} onChange={(e) => setNewDraft({ ...newDraft, nombre: e.target.value })} />
              <div>
                <label style={{ fontSize: 10.5, color: "#7A7D85", textTransform: "uppercase" }}>Costo</label>
                <input type="number" placeholder="0" value={newDraft.costo} onChange={(e) => actualizarDesdeCosto(e.target.value)} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10.5, color: "#7A7D85", textTransform: "uppercase" }}>Margen (%)</label>
                  <input type="number" placeholder="100" value={newDraft.porcentaje} onChange={(e) => actualizarDesdePorcentaje(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10.5, color: "#7A7D85", textTransform: "uppercase" }}>Precio venta</label>
                  <input type="number" placeholder="0" value={newDraft.precio} onChange={(e) => actualizarDesdePrecio(e.target.value)} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10.5, color: "#7A7D85", textTransform: "uppercase" }}>Stock inicial</label>
                <input type="number" placeholder="0" value={newDraft.stock} onChange={(e) => setNewDraft({ ...newDraft, stock: e.target.value })} />
              </div>
              <div style={{ fontSize: 11, color: "#7A7D85" }}>
                100% de margen es el valor sugerido para accesorios (cargás el doble del costo). Ajustalo cuando quieras: tocando el % recalcula el precio, y si editás el precio directo, recalcula el %.
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setAdding(false)} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid #D8D4CB", background: "none", color: "#1F2023", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button onClick={addProduct} style={{ flex: 2, padding: "12px 0", borderRadius: 10, border: "none", background: "#FF7A30", color: "#15171B", fontWeight: 700, cursor: "pointer" }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
      {/* Edit product modal */}
      {editingId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => { setEditingId(null); setConfirmDelete(false); }}>
          <div style={{ background: "#FAF8F3", color: "#1F2023", width: "100%", maxWidth: 420, borderRadius: "18px 18px 0 0", padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div className="display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>Editar producto</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 8 }}>
              <input type="text" placeholder="Nombre" value={editDraft.nombre} onChange={(e) => setEditDraft({ ...editDraft, nombre: e.target.value })} />
              <div>
                <label style={{ fontSize: 10.5, color: "#7A7D85", textTransform: "uppercase" }}>Costo</label>
                <input type="number" value={editDraft.costo} onChange={(e) => editDesdeCosto(e.target.value)} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10.5, color: "#7A7D85", textTransform: "uppercase" }}>Margen (%)</label>
                  <input type="number" value={editDraft.porcentaje} onChange={(e) => editDesdePorcentaje(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10.5, color: "#7A7D85", textTransform: "uppercase" }}>Precio venta</label>
                  <input type="number" value={editDraft.precio} onChange={(e) => editDesdePrecio(e.target.value)} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10.5, color: "#7A7D85", textTransform: "uppercase" }}>Stock</label>
                <input type="number" value={editDraft.stock} onChange={(e) => setEditDraft({ ...editDraft, stock: e.target.value })} />
              </div>
            </div>

            {!confirmDelete ? (
              <>
                <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <button onClick={() => { setEditingId(null); setConfirmDelete(false); }} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid #D8D4CB", background: "none", color: "#1F2023", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
                  <button onClick={saveEdit} style={{ flex: 2, padding: "12px 0", borderRadius: 10, border: "none", background: "#FF7A30", color: "#15171B", fontWeight: 700, cursor: "pointer" }}>Guardar cambios</button>
                </div>
                <button
                  onClick={() => setConfirmDelete(true)}
                  style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "none", background: "none", color: "#E5484D", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <Trash2 size={14} /> Eliminar producto
                </button>
              </>
            ) : (
              <div style={{ background: "#FBEAEA", borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 13, marginBottom: 10 }}>¿Eliminar <strong>{editDraft.nombre}</strong> del inventario? No se puede deshacer.</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid #D8D4CB", background: "none", color: "#1F2023", fontWeight: 600, cursor: "pointer" }}>No, volver</button>
                  <button onClick={deleteProduct} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "#E5484D", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Sí, eliminar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Label / barcode modal */}
      {labelProduct && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setLabelProduct(null)}>
          <div style={{ background: "#FAF8F3", color: "#1F2023", width: "100%", maxWidth: 420, borderRadius: "18px 18px 0 0", padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div className="display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Etiqueta de {labelProduct.nombre}</div>
            <div style={{ fontSize: 12, color: "#7A7D85", marginBottom: 14 }}>Imprimila y pegala en el producto. Al escanearla, se va a registrar la venta solo.</div>

            <div id="etiqueta-imprimir" style={{ border: "1px dashed #C9C5BB", borderRadius: 10, padding: 14, textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Displayfix</div>
              <div style={{ fontSize: 13, marginBottom: 6 }}>{labelProduct.nombre}</div>
              <img src={barcodeUrl(labelProduct.codigo)} alt={labelProduct.codigo} style={{ width: "100%", maxWidth: 260 }} />
              <div className="mono" style={{ fontSize: 11, marginTop: 2 }}>{labelProduct.codigo}</div>
              <div className="mono" style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>{money(labelProduct.precio)}</div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setLabelProduct(null)} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid #D8D4CB", background: "none", color: "#1F2023", fontWeight: 600, cursor: "pointer" }}>Cerrar</button>
              <button onClick={() => window.print()} style={{ flex: 2, padding: "12px 0", borderRadius: 10, border: "none", background: "#FF7A30", color: "#15171B", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Printer size={15} /> Imprimir etiqueta
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Camera scan modal */}
      {cameraOpen && (
        <div style={{ position: "fixed", inset: 0, background: "#000", display: "flex", flexDirection: "column", zIndex: 50 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 14 }}>
            <span style={{ color: "#FAF8F3", fontSize: 14, fontWeight: 600 }}>Apuntá al código de barra</span>
            <button onClick={cerrarCamara} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: 8, color: "#fff", cursor: "pointer" }}><X size={18} /></button>
          </div>
          <video ref={videoRef} muted playsInline style={{ flex: 1, width: "100%", objectFit: "cover" }} />
          {cameraError && (
            <div style={{ background: "#3B1F1F", color: "#E5848A", fontSize: 12.5, padding: 14, margin: 14, borderRadius: 10 }}>
              {cameraError}
            </div>
          )}
        </div>
      )}

      {/* Cierre de caja modal */}
      {cierreInfo && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setCierreInfo(null)}>
          <div style={{ background: "#FAF8F3", color: "#1F2023", width: "100%", maxWidth: 420, borderRadius: "18px 18px 0 0", padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div className="display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 2 }}>
              {cierreInfo.automatico ? "Cierre automático — 17:15" : "Cierre de caja"}
            </div>
            <div style={{ fontSize: 12, color: "#7A7D85", marginBottom: 16 }}>{cierreInfo.fecha}</div>

            <div style={{ background: "#F0EEE8", borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13.5 }}>
                <span>Ventas registradas</span>
                <span className="mono" style={{ fontWeight: 600 }}>{cierreInfo.cantidad}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13.5, borderTop: "1px dashed #D8D4CB" }}>
                <span>Total vendido</span>
                <span className="mono" style={{ fontWeight: 600 }}>{money(cierreInfo.totalVentas)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14, borderTop: "1px dashed #D8D4CB" }}>
                <span style={{ fontWeight: 700 }}>Ganancia bruta</span>
                <span className="mono" style={{ fontWeight: 700, color: "#2E9C6F" }}>{money(cierreInfo.totalGanancia)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13.5, borderTop: "1px dashed #D8D4CB" }}>
                <span>Gastos de hoy</span>
                <span className="mono" style={{ color: "#E5484D" }}>− {money(cierreInfo.gastosHoy || 0)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14.5, borderTop: "1px solid #D8D4CB" }}>
                <span style={{ fontWeight: 700 }}>Ganancia neta</span>
                <span className="mono" style={{ fontWeight: 700 }}>{money(cierreInfo.gananciaNeta != null ? cierreInfo.gananciaNeta : cierreInfo.totalGanancia)}</span>
              </div>
            </div>

            <div style={{ fontSize: 11, color: "#7A7D85", marginBottom: 16 }}>
              {cierreInfo.automatico
                ? "Se cerró solo porque son las 17:15. La cinta de ventas de hoy se vació para arrancar el día siguiente."
                : "Cierre manual: la cinta de ventas de hoy se vació. Esto no afecta el stock."}
            </div>

            <button onClick={() => setCierreInfo(null)} style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "none", background: "#FF7A30", color: "#15171B", fontWeight: 700, cursor: "pointer" }}>Aceptar</button>
          </div>
        </div>
      )}
      {/* Confirm expense from tile modal */}
      {confirmGasto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setConfirmGasto(null)}>
          <div style={{ background: "#FAF8F3", color: "#1F2023", width: "100%", maxWidth: 420, borderRadius: "18px 18px 0 0", padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div className="display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{confirmGasto.nombre}</div>
            <div style={{ fontSize: 12, color: "#7A7D85", marginBottom: 14 }}>Editá el monto si hoy gastaste distinto. Se va a guardar como el nuevo valor por defecto.</div>
            <label style={{ fontSize: 11, color: "#7A7D85", textTransform: "uppercase" }}>Monto</label>
            <input type="number" value={confirmGastoMonto} onChange={(e) => setConfirmGastoMonto(e.target.value)} style={{ fontSize: 18, padding: "10px 12px", marginTop: 4, marginBottom: 14 }} className="mono" />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmGasto(null)} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid #D8D4CB", background: "none", color: "#1F2023", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button onClick={registrarGastoTile} style={{ flex: 2, padding: "12px 0", borderRadius: 10, border: "none", background: "#FF7A30", color: "#15171B", fontWeight: 700, cursor: "pointer" }}>Registrar gasto</button>
            </div>
          </div>
        </div>
      )}

      {/* Add expense tile modal */}
      {addingGastoTile && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setAddingGastoTile(false)}>
          <div style={{ background: "#FAF8F3", color: "#1F2023", width: "100%", maxWidth: 420, borderRadius: "18px 18px 0 0", padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div className="display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>Nuevo mosaico de gasto</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 10.5, color: "#7A7D85", textTransform: "uppercase" }}>Nombre</label>
                <input type="text" placeholder="Ej: Nafta, Internet..." value={newGastoTileDraft.nombre} onChange={(e) => setNewGastoTileDraft({ ...newGastoTileDraft, nombre: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 10.5, color: "#7A7D85", textTransform: "uppercase" }}>Monto habitual (opcional)</label>
                <input type="number" placeholder="0" value={newGastoTileDraft.monto} onChange={(e) => setNewGastoTileDraft({ ...newGastoTileDraft, monto: e.target.value })} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setAddingGastoTile(false)} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid #D8D4CB", background: "none", color: "#1F2023", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button onClick={addGastoTile} style={{ flex: 2, padding: "12px 0", borderRadius: 10, border: "none", background: "#FF7A30", color: "#15171B", fontWeight: 700, cursor: "pointer" }}>Guardar mosaico</button>
            </div>
          </div>
        </div>
      )}

      {/* Add expense modal */}
      {addingGasto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setAddingGasto(false)}>
          <div style={{ background: "#FAF8F3", color: "#1F2023", width: "100%", maxWidth: 420, borderRadius: "18px 18px 0 0", padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div className="display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>Nuevo gasto</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 10.5, color: "#7A7D85", textTransform: "uppercase" }}>Concepto</label>
                <input type="text" placeholder="Ej: Luz, alquiler, insumos..." value={gastoDraft.concepto} onChange={(e) => setGastoDraft({ ...gastoDraft, concepto: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 10.5, color: "#7A7D85", textTransform: "uppercase" }}>Monto</label>
                <input type="number" placeholder="0" value={gastoDraft.monto} onChange={(e) => setGastoDraft({ ...gastoDraft, monto: e.target.value })} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setAddingGasto(false)} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid #D8D4CB", background: "none", color: "#1F2023", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button onClick={addGasto} style={{ flex: 2, padding: "12px 0", borderRadius: 10, border: "none", background: "#FF7A30", color: "#15171B", fontWeight: 700, cursor: "pointer" }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
