import { useState, useEffect, createContext, useContext, useRef, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";
import { Sword, Shield, Zap, Heart, Trophy, Users, ShoppingBag, ScrollText, Crown, LogOut, Menu, X, ChevronUp, Target, Clock, Skull, Star, Lock, Unlock, Dumbbell, Flame, Ghost, Sparkles, Timer, Play, Pause, RotateCcw, Check, AlertTriangle, BarChart3, Calendar, TrendingUp, Award, Swords } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext(null);

const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (authToken) => {
    try {
      const res = await axios.get(`${API}/user/profile`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setUser(res.data);
    } catch (e) {
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchProfile(token);
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password });
    localStorage.setItem("token", res.data.token);
    setToken(res.data.token);
    await fetchProfile(res.data.token);
    return res.data;
  };

  const register = async (email, password, hunterName) => {
    const res = await axios.post(`${API}/auth/register`, { email, password, hunter_name: hunterName });
    localStorage.setItem("token", res.data.token);
    setToken(res.data.token);
    await fetchProfile(res.data.token);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (token) await fetchProfile(token);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// Protected Route
const ProtectedRoute = ({ children }) => {
  const { token, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!token) return <Navigate to="/" replace />;
  return children;
};

// Loading Screen
const LoadingScreen = () => (
  <div className="min-h-screen bg-[#020617] flex items-center justify-center">
    <div className="text-center">
      <div className="text-4xl font-bold text-blue-500 text-glow animate-pulse">SISTEMA</div>
      <div className="mt-4 text-slate-400">Conectando...</div>
    </div>
  </div>
);

// Landing / Auth Page
const LandingPage = () => {
  const { token, login, register } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hunterName, setHunterName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) navigate("/dashboard");
  }, [token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
        toast.success("[SISTEMA] Conexión establecida");
      } else {
        await register(email, password, hunterName);
        toast.success("[SISTEMA] Nuevo cazador registrado");
      }
      navigate("/dashboard");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] bg-pattern relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-slate-900/20" />
      <div className="absolute inset-0 hero-overlay" />
      
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        <div className="mb-12 text-center">
          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter uppercase">
            <span className="text-blue-500 text-glow">SOLO</span> LEVELING
          </h1>
          <p className="mt-4 text-slate-400 text-lg tracking-widest uppercase">Sistema de Entrenamiento Real</p>
          <div className="mt-2 flex items-center justify-center gap-2 text-yellow-500">
            <Flame className="w-5 h-5" />
            <span className="text-sm">Meta: 100 Flexiones • 100 Sentadillas • 100 Abdominales • 10km</span>
            <Flame className="w-5 h-5" />
          </div>
        </div>

        <div className="system-window w-full max-w-md">
          <div className="system-window-header flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500" />
            <span className="text-blue-400 font-semibold uppercase tracking-wider text-sm">
              {isLogin ? "Acceso al Sistema" : "Registro de Cazador"}
            </span>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-slate-400 text-sm mb-2 uppercase tracking-wider">Nombre de Cazador</label>
                <Input
                  data-testid="hunter-name-input"
                  type="text"
                  value={hunterName}
                  onChange={(e) => setHunterName(e.target.value)}
                  className="input-system w-full"
                  placeholder="Sung Jin-Woo"
                  required={!isLogin}
                />
              </div>
            )}
            
            <div>
              <label className="block text-slate-400 text-sm mb-2 uppercase tracking-wider">Email</label>
              <Input
                data-testid="email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-system w-full"
                placeholder="hunter@system.com"
                required
              />
            </div>
            
            <div>
              <label className="block text-slate-400 text-sm mb-2 uppercase tracking-wider">Contraseña</label>
              <Input
                data-testid="password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-system w-full"
                placeholder="••••••••"
                required
              />
            </div>
            
            <Button
              data-testid="submit-btn"
              type="submit"
              disabled={loading}
              className="btn-system-solid w-full mt-6"
            >
              {loading ? "Conectando..." : isLogin ? "Acceder" : "Registrarse"}
            </Button>
            
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="w-full text-center text-slate-500 hover:text-blue-400 text-sm mt-4 transition-colors"
            >
              {isLogin ? "¿Nuevo cazador? Regístrate" : "¿Ya tienes cuenta? Accede"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// Navigation
const Navigation = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { path: "/dashboard", label: "Panel", icon: Target },
    { path: "/quests", label: "Misiones", icon: ScrollText },
    { path: "/dungeons", label: "Mazmorras", icon: Skull },
    { path: "/bosses", label: "Jefes", icon: Swords },
    { path: "/shadows", label: "Sombras", icon: Ghost },
    { path: "/profile", label: "Cazador", icon: Crown },
    { path: "/shop", label: "Tienda", icon: ShoppingBag },
    { path: "/guilds", label: "Gremios", icon: Users },
    { path: "/ranking", label: "Ranking", icon: Trophy },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-dark border-b border-blue-500/20">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={() => navigate("/dashboard")}
          >
            <div className="w-8 h-8 bg-blue-500 flex items-center justify-center">
              <Sword className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white text-lg hidden sm:block">SISTEMA</span>
          </div>

          <div className="hidden lg:flex items-center gap-4">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`nav-item flex items-center gap-2 py-4 text-xs uppercase tracking-wider font-medium ${location.pathname === item.path ? "active" : ""}`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3">
              {user?.streak > 0 && (
                <div className="flex items-center gap-1 text-orange-400">
                  <Flame className="w-4 h-4" />
                  <span className="font-bold">{user.streak}</span>
                </div>
              )}
              <div className={`rank-badge rank-badge-${user?.rank?.toLowerCase()}`}>
                {user?.rank}
              </div>
              <span className="text-slate-300 font-medium">Nv.{user?.level}</span>
            </div>
            <button
              data-testid="logout-btn"
              onClick={logout}
              className="text-slate-400 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <button
              className="lg:hidden text-slate-400"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden glass-dark border-t border-blue-500/20 max-h-[70vh] overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); setMobileOpen(false); }}
              className={`flex items-center gap-3 w-full px-4 py-3 text-left ${location.pathname === item.path ? "text-blue-400 bg-blue-500/10" : "text-slate-400"}`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
};

// Layout
const Layout = ({ children }) => (
  <div className="min-h-screen bg-[#020617] bg-pattern">
    <Navigation />
    <main className="pt-20 pb-8 px-4">
      <div className="max-w-7xl mx-auto">
        {children}
      </div>
    </main>
  </div>
);

// Stat Bar Component
const StatBar = ({ label, value, bonus = 0, maxValue = 100, icon: Icon, colorClass }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="w-4 h-4" />
        <span className="uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-white font-bold">
        {value}
        {bonus > 0 && <span className="text-purple-400 ml-1">(+{bonus})</span>}
      </span>
    </div>
    <div className="stat-bar">
      <div 
        className={`stat-bar-fill ${colorClass}`} 
        style={{ width: `${Math.min(((value + bonus) / maxValue) * 100, 100)}%` }} 
      />
    </div>
  </div>
);

// Training Timer Component
const TrainingTimer = ({ questId, deadline, onComplete, onFail }) => {
  const { token } = useAuth();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const intervalRef = useRef(null);
  
  const deadlineDate = deadline ? new Date(deadline) : null;
  const timeRemaining = deadlineDate ? Math.max(0, deadlineDate - Date.now()) : 0;
  const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
  const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

  const startTraining = async () => {
    try {
      await axios.post(
        `${API}/quests/start-training`,
        { quest_id: questId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStartTime(Date.now());
      setIsRunning(true);
    } catch (e) {
      toast.error("Error al iniciar entrenamiento");
    }
  };

  const pauseTraining = () => {
    setIsRunning(false);
  };

  const resumeTraining = () => {
    setStartTime(Date.now() - elapsedTime);
    setIsRunning(true);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setElapsedTime(0);
    setStartTime(null);
  };

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, startTime]);

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="quest-card p-6 border-blue-500/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Timer className="w-6 h-6 text-blue-500" />
          <h3 className="text-lg font-bold text-white uppercase">Cronómetro de Entrenamiento</h3>
        </div>
      </div>

      {/* Countdown to deadline */}
      <div className="flex items-center gap-2 text-sm mb-4 p-3 bg-slate-900/50 border border-slate-700">
        <Clock className="w-4 h-4 text-yellow-500" />
        <span className="text-slate-400">Tiempo restante para completar:</span>
        <span className={`font-bold ${hoursRemaining < 6 ? 'text-red-400' : 'text-yellow-400'}`}>
          {hoursRemaining}h {minutesRemaining}m
        </span>
      </div>

      {/* Elapsed time display */}
      <div className="text-center py-6">
        <div className="text-5xl font-mono font-bold text-blue-400 text-glow">
          {formatTime(elapsedTime)}
        </div>
        <p className="text-slate-500 mt-2">Tiempo de entrenamiento</p>
      </div>

      {/* Timer controls */}
      <div className="flex items-center justify-center gap-4 mb-6">
        {!isRunning && elapsedTime === 0 && (
          <Button onClick={startTraining} className="btn-system-solid flex items-center gap-2">
            <Play className="w-5 h-5" />
            Iniciar
          </Button>
        )}
        {isRunning && (
          <Button onClick={pauseTraining} className="btn-system flex items-center gap-2">
            <Pause className="w-5 h-5" />
            Pausar
          </Button>
        )}
        {!isRunning && elapsedTime > 0 && (
          <>
            <Button onClick={resumeTraining} className="btn-system-solid flex items-center gap-2">
              <Play className="w-5 h-5" />
              Continuar
            </Button>
            <Button onClick={resetTimer} className="btn-system flex items-center gap-2">
              <RotateCcw className="w-5 h-5" />
              Reiniciar
            </Button>
          </>
        )}
      </div>

      {/* Complete/Fail buttons */}
      <div className="flex gap-4">
        <Button
          data-testid="complete-training-btn"
          onClick={onComplete}
          className="btn-system-solid flex-1 flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" />
          Completar Entrenamiento
        </Button>
        <Button
          data-testid="fail-training-btn"
          onClick={onFail}
          className="btn-system text-red-400 border-red-500/50 hover:bg-red-500/10 flex items-center justify-center gap-2"
        >
          <AlertTriangle className="w-5 h-5" />
          Fallar
        </Button>
      </div>
    </div>
  );
};

// Dashboard Page
const DashboardPage = () => {
  const { user, refreshUser, token } = useAuth();
  const [dailyQuest, setDailyQuest] = useState(null);
  const [punishments, setPunishments] = useState([]);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showShadow, setShowShadow] = useState(null);
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const [questRes, punishRes] = await Promise.all([
        axios.get(`${API}/quests/daily`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/quests/punishment`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setDailyQuest(questRes.data);
      setPunishments(punishRes.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const completeQuest = async (questId) => {
    try {
      const res = await axios.post(
        `${API}/quests/complete`,
        { quest_id: questId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`[SISTEMA] +${res.data.exp_gained} EXP | +${res.data.gold_gained} Oro`);
      if (res.data.level_up) {
        setShowLevelUp(true);
        setTimeout(() => setShowLevelUp(false), 3000);
      }
      if (res.data.shadow_earned) {
        setShowShadow(res.data.shadow_earned);
      }
      if (res.data.achievements_unlocked?.length > 0) {
        res.data.achievements_unlocked.forEach(ach => {
          toast.success(`[LOGRO] ${ach.name} desbloqueado!`, { icon: <Award className="w-5 h-5 text-yellow-500" /> });
        });
      }
      await refreshUser();
      await fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al completar misión");
    }
  };

  const failQuest = async (questId) => {
    try {
      const res = await axios.post(
        `${API}/quests/fail`,
        { quest_id: questId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.error(res.data.message);
      await refreshUser();
      await fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error");
    }
  };

  if (!user) return <LoadingScreen />;

  const expProgress = (user.experience / user.exp_to_next) * 100;
  const shadowBonuses = user.shadow_bonuses || {};

  return (
    <Layout>
      {/* Level Up Modal */}
      <Dialog open={showLevelUp} onOpenChange={setShowLevelUp}>
        <DialogContent className="system-window border-yellow-500">
          <div className="text-center py-8">
            <ChevronUp className="w-16 h-16 text-yellow-500 mx-auto animate-bounce" />
            <h2 className="text-3xl font-black text-yellow-500 text-glow-purple mt-4">¡NIVEL ARRIBA!</h2>
            <p className="text-slate-400 mt-2">Has alcanzado el nivel {user.level}</p>
            <p className="text-blue-400 mt-4">+3 Puntos de Estadística</p>
            {user.level === 50 && (
              <p className="text-orange-400 mt-2 font-bold">¡Has desbloqueado el entrenamiento de Sung Jin-Woo!</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Shadow Earned Modal */}
      <Dialog open={!!showShadow} onOpenChange={() => setShowShadow(null)}>
        <DialogContent className="system-window border-purple-500">
          <div className="text-center py-8">
            <Ghost className="w-16 h-16 text-purple-500 mx-auto animate-pulse" />
            <h2 className="text-3xl font-black text-purple-400 mt-4">¡NUEVA SOMBRA!</h2>
            <p className="text-white text-xl mt-2">{showShadow?.name}</p>
            <div className={`inline-block px-3 py-1 mt-2 text-sm font-bold rarity-${showShadow?.rarity}`}>
              {showShadow?.rarity?.toUpperCase()}
            </div>
            <div className="mt-4 text-slate-400">
              {showShadow?.stat_bonus && Object.entries(showShadow.stat_bonus).map(([stat, val]) => (
                <span key={stat} className="inline-block mx-2 text-green-400">+{val} {stat}</span>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div data-testid="dashboard" className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-slate-500 text-sm uppercase tracking-widest">Cazador</p>
            <h1 className="text-3xl md:text-4xl font-black text-white">{user.hunter_name}</h1>
            <p className="text-blue-400 mt-1">{user.title}</p>
          </div>
          <div className="flex items-center gap-4">
            {user.streak > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/30">
                <Flame className="w-6 h-6 text-orange-500" />
                <div>
                  <div className="text-orange-400 font-bold text-xl">{user.streak} días</div>
                  <div className="text-orange-400/60 text-xs">Racha actual</div>
                </div>
              </div>
            )}
            <div className={`rank-badge rank-badge-${user.rank.toLowerCase()} text-2xl px-6 py-2`}>
              RANGO {user.rank}
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Stats */}
          <div className="space-y-6">
            {/* Level & EXP */}
            <div className="quest-card p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-400 uppercase tracking-wider text-sm">Nivel</span>
                <span className="text-3xl font-black text-white">{user.level}</span>
              </div>
              <Progress value={expProgress} className="h-3 bg-slate-800" />
              <div className="flex justify-between mt-2 text-sm">
                <span className="text-slate-500">{user.experience} EXP</span>
                <span className="text-blue-400">{user.exp_to_next} EXP</span>
              </div>
              {user.level >= 50 && (
                <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/30 text-center">
                  <span className="text-yellow-400 text-sm font-bold">🔥 Entrenamiento Sung Jin-Woo Activo 🔥</span>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="quest-card p-6 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-white uppercase tracking-wider">Estadísticas</h3>
                {user.stat_points > 0 && (
                  <span className="text-blue-400 text-sm">+{user.stat_points} puntos</span>
                )}
              </div>
              <StatBar label="Fuerza" value={user.stats.strength} bonus={shadowBonuses.strength || 0} icon={Sword} colorClass="stat-strength" />
              <StatBar label="Resistencia" value={user.stats.endurance} bonus={shadowBonuses.endurance || 0} icon={Shield} colorClass="stat-endurance" />
              <StatBar label="Agilidad" value={user.stats.agility} bonus={shadowBonuses.agility || 0} icon={Zap} colorClass="stat-agility" />
              <StatBar label="Vitalidad" value={user.stats.vitality} bonus={shadowBonuses.vitality || 0} icon={Heart} colorClass="stat-vitality" />
              {user.stat_points > 0 && (
                <Button 
                  onClick={() => navigate("/profile")}
                  className="btn-system w-full mt-4"
                >
                  Asignar Puntos
                </Button>
              )}
            </div>

            {/* Quick Stats */}
            <div className="quest-card p-6">
              <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-4">Progreso</h3>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-400">{user.quests_completed}</div>
                  <div className="text-slate-500 text-xs uppercase">Misiones</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-400">{user.best_streak}</div>
                  <div className="text-slate-500 text-xs uppercase">Mejor Racha</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-400">{user.shadows?.length || 0}</div>
                  <div className="text-slate-500 text-xs uppercase">Sombras</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-400">{user.gold}</div>
                  <div className="text-slate-500 text-xs uppercase">Oro</div>
                </div>
              </div>
            </div>
          </div>

          {/* Center Column - Daily Quest */}
          <div className="lg:col-span-2 space-y-6">
            {/* Punishment Warning */}
            {punishments.length > 0 && (
              <div className="quest-card p-6 border-red-500/50 bg-red-950/20">
                <div className="flex items-center gap-3 mb-4">
                  <Skull className="w-6 h-6 text-red-500" />
                  <h3 className="text-lg font-bold text-red-400 uppercase">Castigos Pendientes</h3>
                </div>
                {punishments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-3 border-t border-red-500/20">
                    <div>
                      <p className="text-white font-medium">{p.name}</p>
                      <p className="text-slate-400 text-sm">
                        {p.exercises.map(ex => `${ex.reps} ${ex.unit} ${ex.name}`).join(", ")}
                      </p>
                    </div>
                    <Button
                      data-testid={`complete-punishment-${p.id}`}
                      onClick={() => completeQuest(p.id)}
                      className="btn-system text-sm"
                    >
                      Completar
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Daily Quest */}
            {dailyQuest && (
              <div className="quest-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Target className="w-6 h-6 text-blue-500" />
                    <h3 className="text-lg font-bold text-white uppercase">Misión Diaria</h3>
                  </div>
                  <div className={`rank-badge rank-badge-${dailyQuest.difficulty.toLowerCase()}`}>
                    {dailyQuest.difficulty}
                  </div>
                </div>

                <p className="text-slate-400 mb-4">{dailyQuest.description}</p>

                <div className="space-y-3 mb-6">
                  {dailyQuest.exercises.map((ex, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800">
                      <div className="flex items-center gap-3">
                        <Dumbbell className="w-4 h-4 text-slate-500" />
                        <span className="text-white">{ex.name}</span>
                      </div>
                      <span className="text-blue-400 font-mono text-lg">{ex.reps} {ex.unit}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-sm mb-6">
                  <div className="flex items-center gap-4">
                    <span className="text-green-400">+{dailyQuest.exp_reward} EXP</span>
                    <span className="text-yellow-400">+{dailyQuest.gold_reward} Oro</span>
                  </div>
                </div>

                {dailyQuest.is_completed ? (
                  <div className="text-center py-4 text-green-400 font-bold uppercase tracking-wider">
                    ✓ Misión Completada
                  </div>
                ) : (
                  <TrainingTimer
                    questId={dailyQuest.id}
                    deadline={dailyQuest.deadline}
                    onComplete={() => completeQuest(dailyQuest.id)}
                    onFail={() => failQuest(dailyQuest.id)}
                  />
                )}
              </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Mazmorras", icon: Skull, path: "/dungeons", color: "text-purple-400" },
                { label: "Jefes", icon: Swords, path: "/bosses", color: "text-red-400" },
                { label: "Sombras", icon: Ghost, path: "/shadows", color: "text-purple-400" },
                { label: "Ranking", icon: Trophy, path: "/ranking", color: "text-yellow-400" },
              ].map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="quest-card p-4 card-hover text-center"
                >
                  <item.icon className={`w-8 h-8 ${item.color} mx-auto mb-2`} />
                  <span className="text-slate-300 text-sm uppercase tracking-wider">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

// Quests Page (Includes Special Missions)
const QuestsPage = () => {
  const { token, refreshUser, user } = useAuth();
  const [dailyQuest, setDailyQuest] = useState(null);
  const [punishments, setPunishments] = useState([]);
  const [specialMissions, setSpecialMissions] = useState([]);

  const fetchData = async () => {
    try {
      const [questRes, punishRes, missionsRes] = await Promise.all([
        axios.get(`${API}/quests/daily`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/quests/punishment`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/quests/special-missions`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setDailyQuest(questRes.data);
      setPunishments(punishRes.data);
      setSpecialMissions(missionsRes.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const completeQuest = async (questId) => {
    try {
      const res = await axios.post(
        `${API}/quests/complete`,
        { quest_id: questId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`[SISTEMA] +${res.data.exp_gained} EXP | +${res.data.gold_gained} Oro`);
      if (res.data.shadow_earned) {
        toast.success(`[SOMBRA] ¡${res.data.shadow_earned.name} obtenida!`, { icon: <Ghost className="w-5 h-5 text-purple-500" /> });
      }
      await refreshUser();
      await fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error");
    }
  };

  return (
    <Layout>
      <div data-testid="quests-page" className="space-y-6">
        <h1 className="text-3xl font-black text-white uppercase">Misiones</h1>

        <Tabs defaultValue="daily" className="space-y-6">
          <TabsList className="bg-slate-900 border border-blue-500/20">
            <TabsTrigger value="daily" className="data-[state=active]:bg-blue-500/20">Diarias</TabsTrigger>
            <TabsTrigger value="special" className="data-[state=active]:bg-purple-500/20">Especiales ({specialMissions.filter(m => !m.is_completed).length})</TabsTrigger>
            <TabsTrigger value="punishment" className="data-[state=active]:bg-red-500/20">Castigos ({punishments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="daily">
            {dailyQuest && (
              <div className="quest-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">{dailyQuest.name}</h3>
                  <div className={`rank-badge rank-badge-${dailyQuest.difficulty.toLowerCase()}`}>
                    {dailyQuest.difficulty}
                  </div>
                </div>
                <p className="text-slate-400 mb-6">{dailyQuest.description}</p>
                
                <div className="space-y-3 mb-6">
                  {dailyQuest.exercises.map((ex, i) => (
                    <div key={i} className="flex items-center justify-between py-3 px-4 bg-slate-900/50 border border-slate-800">
                      <span className="text-white font-medium">{ex.name}</span>
                      <span className="text-blue-400 font-mono text-lg">{ex.reps} {ex.unit}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between mb-6">
                  <div className="space-x-4">
                    <span className="text-green-400">+{dailyQuest.exp_reward} EXP</span>
                    <span className="text-yellow-400">+{dailyQuest.gold_reward} Oro</span>
                  </div>
                </div>

                {dailyQuest.is_completed ? (
                  <div className="text-center py-4 text-green-400 font-bold">✓ COMPLETADA</div>
                ) : (
                  <Button
                    data-testid="complete-quest-btn"
                    onClick={() => completeQuest(dailyQuest.id)}
                    className="btn-system-solid w-full"
                  >
                    Completar Misión
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="special">
            <div className="space-y-4">
              {specialMissions.length === 0 ? (
                <div className="quest-card p-8 text-center">
                  <p className="text-slate-400">No hay misiones especiales disponibles en tu nivel</p>
                </div>
              ) : (
                specialMissions.map((mission) => (
                  <div key={mission.id} className={`quest-card p-6 ${mission.is_completed ? 'opacity-60' : ''} ${mission.shadow_reward ? 'border-purple-500/30' : ''}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Sparkles className="w-5 h-5 text-purple-400" />
                        <h3 className="text-lg font-bold text-white">{mission.name}</h3>
                      </div>
                      <span className="text-slate-500 text-sm">Nv.{mission.min_level}+</span>
                    </div>
                    <p className="text-slate-400 mb-4">{mission.description}</p>
                    
                    {/* Progress bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-500">Progreso</span>
                        <span className="text-blue-400">{mission.progress} / {mission.target}</span>
                      </div>
                      <Progress value={(mission.progress / mission.target) * 100} className="h-2 bg-slate-800" />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-green-400 text-sm">+{mission.exp_reward} EXP</span>
                        <span className="text-yellow-400 text-sm">+{mission.gold_reward} Oro</span>
                        {mission.shadow_reward && (
                          <span className="text-purple-400 text-sm flex items-center gap-1">
                            <Ghost className="w-4 h-4" /> Sombra
                          </span>
                        )}
                      </div>
                      {mission.is_completed ? (
                        <span className="text-green-400 font-bold">✓ COMPLETADA</span>
                      ) : mission.can_complete ? (
                        <Button
                          onClick={() => completeQuest(mission.id)}
                          className="btn-system text-sm"
                        >
                          Reclamar
                        </Button>
                      ) : (
                        <span className="text-slate-500 text-sm">En progreso</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="punishment">
            {punishments.length === 0 ? (
              <div className="quest-card p-8 text-center">
                <p className="text-slate-400">No tienes castigos pendientes</p>
              </div>
            ) : (
              <div className="space-y-4">
                {punishments.map((p) => (
                  <div key={p.id} className="quest-card p-6 border-red-500/30">
                    <h3 className="text-lg font-bold text-red-400 mb-4">{p.name}</h3>
                    <div className="space-y-2 mb-4">
                      {p.exercises.map((ex, i) => (
                        <div key={i} className="flex justify-between text-slate-300">
                          <span>{ex.name}</span>
                          <span className="text-red-400">{ex.reps} {ex.unit}</span>
                        </div>
                      ))}
                    </div>
                    <Button
                      onClick={() => completeQuest(p.id)}
                      className="btn-system w-full"
                    >
                      Completar Castigo (+{p.exp_reward} EXP)
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

// Challenge Modal Component - Para mazmorras y jefes
const ChallengeModal = ({ isOpen, onClose, challenge, type, onComplete, onFail }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [exerciseProgress, setExerciseProgress] = useState([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (challenge?.exercises) {
      setExerciseProgress(challenge.exercises.map(() => false));
    }
  }, [challenge]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, startTime]);

  const startChallenge = () => {
    setStartTime(Date.now());
    setIsRunning(true);
  };

  const toggleExercise = (index) => {
    const newProgress = [...exerciseProgress];
    newProgress[index] = !newProgress[index];
    setExerciseProgress(newProgress);
  };

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const allCompleted = exerciseProgress.every(p => p);

  const handleComplete = () => {
    setIsRunning(false);
    setElapsedTime(0);
    setExerciseProgress([]);
    onComplete();
  };

  const handleFail = () => {
    setIsRunning(false);
    setElapsedTime(0);
    setExerciseProgress([]);
    onFail();
  };

  const handleClose = () => {
    setIsRunning(false);
    setElapsedTime(0);
    setExerciseProgress([]);
    onClose();
  };

  if (!challenge) return null;

  const isBoss = type === 'boss';
  const borderColor = isBoss ? 'border-red-500' : 'border-purple-500';
  const accentColor = isBoss ? 'text-red-500' : 'text-purple-500';
  const bgGlow = isBoss ? 'shadow-red-500/20' : 'shadow-purple-500/20';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={`system-window ${borderColor} max-w-2xl shadow-2xl ${bgGlow}`}>
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center border-b border-slate-700 pb-4">
            <div className={`inline-flex items-center gap-2 px-4 py-1 bg-slate-900 border ${borderColor} mb-3`}>
              {isBoss ? <Swords className={`w-5 h-5 ${accentColor}`} /> : <Skull className={`w-5 h-5 ${accentColor}`} />}
              <span className={`text-sm font-bold uppercase ${accentColor}`}>
                {isBoss ? 'COMBATE DE JEFE' : 'MAZMORRA'}
              </span>
            </div>
            <h2 className="text-2xl font-black text-white uppercase">{challenge.name}</h2>
            <p className="text-slate-400 mt-1">{challenge.description}</p>
            <div className={`rank-badge rank-badge-${challenge.difficulty?.toLowerCase()} mt-2`}>
              RANGO {challenge.difficulty}
            </div>
          </div>

          {/* Timer */}
          <div className="text-center py-4 bg-slate-900/50 border border-slate-700">
            <div className={`text-5xl font-mono font-bold ${accentColor} text-glow`}>
              {formatTime(elapsedTime)}
            </div>
            <p className="text-slate-500 mt-1">Tiempo de entrenamiento</p>
          </div>

          {/* Exercises */}
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-white uppercase flex items-center gap-2">
              <Dumbbell className="w-5 h-5" />
              Retos a Completar
            </h3>
            {challenge.exercises?.map((ex, i) => (
              <div 
                key={i}
                onClick={() => isRunning && toggleExercise(i)}
                className={`flex items-center justify-between p-4 border-2 transition-all cursor-pointer ${
                  exerciseProgress[i] 
                    ? 'border-green-500 bg-green-500/10' 
                    : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                } ${!isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 flex items-center justify-center border-2 ${
                    exerciseProgress[i] ? 'border-green-500 bg-green-500' : 'border-slate-600'
                  }`}>
                    {exerciseProgress[i] && <Check className="w-5 h-5 text-white" />}
                  </div>
                  <span className={`font-medium ${exerciseProgress[i] ? 'text-green-400 line-through' : 'text-white'}`}>
                    {ex.name}
                  </span>
                </div>
                <span className={`font-mono text-xl font-bold ${exerciseProgress[i] ? 'text-green-400' : accentColor}`}>
                  {ex.reps} {ex.unit}
                </span>
              </div>
            ))}
          </div>

          {/* Rewards */}
          <div className="flex items-center justify-center gap-6 py-3 bg-slate-900/30 border border-slate-800">
            <div className="text-center">
              <span className="text-green-400 font-bold text-lg">+{challenge.exp_reward}</span>
              <p className="text-slate-500 text-xs">EXP</p>
            </div>
            <div className="text-center">
              <span className="text-yellow-400 font-bold text-lg">+{challenge.gold_reward}</span>
              <p className="text-slate-500 text-xs">ORO</p>
            </div>
            {challenge.shadow_reward && (
              <div className="text-center">
                <Ghost className="w-6 h-6 text-purple-400 mx-auto" />
                <p className="text-purple-400 text-xs font-bold">SOMBRA</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {!isRunning && elapsedTime === 0 && (
              <Button onClick={startChallenge} className="btn-system-solid w-full text-lg py-6">
                <Play className="w-6 h-6 mr-2" />
                ¡INICIAR {isBoss ? 'COMBATE' : 'MAZMORRA'}!
              </Button>
            )}

            {isRunning && (
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  onClick={handleComplete}
                  disabled={!allCompleted}
                  className={`btn-system-solid py-4 ${!allCompleted ? 'opacity-50' : ''}`}
                >
                  <Check className="w-5 h-5 mr-2" />
                  {allCompleted ? '¡VICTORIA!' : 'Completa todo'}
                </Button>
                <Button 
                  onClick={handleFail}
                  className="btn-system border-red-500/50 text-red-400 hover:bg-red-500/10 py-4"
                >
                  <X className="w-5 h-5 mr-2" />
                  Rendirse
                </Button>
              </div>
            )}

            {!isRunning && elapsedTime === 0 && (
              <p className="text-center text-slate-500 text-sm">
                Marca cada ejercicio como completado durante el reto
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Dungeons Page
const DungeonsPage = () => {
  const { token, refreshUser, user } = useAuth();
  const [dungeons, setDungeons] = useState([]);
  const [activeDungeon, setActiveDungeon] = useState(null);
  const [showVictory, setShowVictory] = useState(null);

  useEffect(() => {
    const fetchDungeons = async () => {
      try {
        const res = await axios.get(`${API}/quests/special`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setDungeons(res.data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchDungeons();
  }, [token]);

  const completeDungeon = async () => {
    if (!activeDungeon) return;
    try {
      const res = await axios.post(
        `${API}/quests/complete`,
        { quest_id: activeDungeon.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActiveDungeon(null);
      setShowVictory(res.data);
      toast.success(`[SISTEMA] ¡Mazmorra conquistada! +${res.data.exp_gained} EXP`);
      if (res.data.achievements_unlocked?.length > 0) {
        res.data.achievements_unlocked.forEach(ach => {
          toast.success(`[LOGRO] ${ach.name} desbloqueado!`);
        });
      }
      await refreshUser();
      // Refresh dungeons
      const dungeonRes = await axios.get(`${API}/quests/special`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDungeons(dungeonRes.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error");
    }
  };

  const failDungeon = async () => {
    if (!activeDungeon) return;
    try {
      await axios.post(
        `${API}/quests/fail`,
        { quest_id: activeDungeon.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActiveDungeon(null);
      toast.error("[SISTEMA] Has sido derrotado en la mazmorra. Se te ha asignado un castigo.");
      await refreshUser();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error");
    }
  };

  // Group dungeons by difficulty
  const groupedDungeons = dungeons.reduce((acc, d) => {
    if (!acc[d.difficulty]) acc[d.difficulty] = [];
    acc[d.difficulty].push(d);
    return acc;
  }, {});

  const rankOrder = ['E', 'D', 'C', 'B', 'A', 'S'];

  return (
    <Layout>
      {/* Challenge Modal */}
      <ChallengeModal
        isOpen={!!activeDungeon}
        onClose={() => setActiveDungeon(null)}
        challenge={activeDungeon}
        type="dungeon"
        onComplete={completeDungeon}
        onFail={failDungeon}
      />

      {/* Victory Modal */}
      <Dialog open={!!showVictory} onOpenChange={() => setShowVictory(null)}>
        <DialogContent className="system-window border-green-500">
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-3xl font-black text-green-400 mb-2">¡MAZMORRA CONQUISTADA!</h2>
            <div className="space-y-2 mt-4">
              <p className="text-green-400 text-xl">+{showVictory?.exp_gained} EXP</p>
              <p className="text-yellow-400 text-xl">+{showVictory?.gold_gained} Oro</p>
              {showVictory?.level_up && (
                <p className="text-blue-400 text-xl animate-pulse">¡SUBISTE DE NIVEL!</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div data-testid="dungeons-page" className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skull className="w-8 h-8 text-purple-500" />
            <h1 className="text-3xl font-black text-white uppercase">Mazmorras</h1>
          </div>
          <div className="text-slate-400">
            Completadas: <span className="text-white font-bold">
              {Object.values(user?.dungeons_completed || {}).reduce((a, b) => a + b, 0)}
            </span>
          </div>
        </div>

        <div className="quest-card p-4 border-purple-500/30 bg-purple-950/20">
          <p className="text-purple-300">
            <strong>⚔️ Sistema de Retos:</strong> Al entrar en una mazmorra deberás completar TODOS los ejercicios. 
            Marca cada ejercicio como completado cuando lo termines. ¡Si te rindes recibirás un castigo!
          </p>
        </div>

        {rankOrder.map(rank => (
          groupedDungeons[rank] && (
            <div key={rank} className="space-y-4">
              <h2 className={`text-xl font-bold rank-badge-${rank.toLowerCase()} border-b border-current pb-2`}>
                Rango {rank} - {user?.dungeons_completed?.[rank] || 0} completadas
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groupedDungeons[rank].map((dungeon) => (
                  <div 
                    key={dungeon.id} 
                    className={`quest-card p-6 difficulty-${dungeon.difficulty.toLowerCase()} border-2 card-hover`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-white">{dungeon.name}</h3>
                      <span className="text-slate-500 text-sm">Nv.{dungeon.min_level}+</span>
                    </div>
                    <p className="text-slate-400 text-sm mb-4">{dungeon.description}</p>

                    <div className="space-y-2 mb-4">
                      {dungeon.exercises.map((ex, i) => (
                        <div key={i} className="flex justify-between items-center p-2 bg-slate-900/50 border border-slate-800">
                          <div className="flex items-center gap-2">
                            <Dumbbell className="w-4 h-4 text-purple-400" />
                            <span className="text-white">{ex.name}</span>
                          </div>
                          <span className="text-purple-400 font-mono font-bold">{ex.reps} {ex.unit}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-sm mb-4">
                      <span className="text-green-400">+{dungeon.exp_reward} EXP</span>
                      <span className="text-yellow-400">+{dungeon.gold_reward} Oro</span>
                    </div>

                    <Button
                      data-testid={`enter-dungeon-${dungeon.id}`}
                      onClick={() => setActiveDungeon(dungeon)}
                      className="btn-system w-full border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                    >
                      <Skull className="w-4 h-4 mr-2" />
                      Entrar a la Mazmorra
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )
        ))}
      </div>
    </Layout>
  );
};

// Bosses Page
const BossesPage = () => {
  const { token, refreshUser, user } = useAuth();
  const [bosses, setBosses] = useState([]);
  const [activeBoss, setActiveBoss] = useState(null);
  const [showShadow, setShowShadow] = useState(null);
  const [showVictory, setShowVictory] = useState(null);

  useEffect(() => {
    const fetchBosses = async () => {
      try {
        const res = await axios.get(`${API}/quests/weekly-boss`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setBosses(res.data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchBosses();
  }, [token]);

  const defeatBoss = async () => {
    if (!activeBoss) return;
    try {
      const res = await axios.post(
        `${API}/quests/complete`,
        { quest_id: activeBoss.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActiveBoss(null);
      
      if (res.data.shadow_earned) {
        setShowShadow(res.data.shadow_earned);
      } else {
        setShowVictory(res.data);
      }
      
      toast.success(`[SISTEMA] ¡Jefe derrotado! +${res.data.exp_gained} EXP`);
      if (res.data.achievements_unlocked?.length > 0) {
        res.data.achievements_unlocked.forEach(ach => {
          toast.success(`[LOGRO] ${ach.name} desbloqueado!`);
        });
      }
      await refreshUser();
      // Refresh bosses list
      const bossRes = await axios.get(`${API}/quests/weekly-boss`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBosses(bossRes.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error");
    }
  };

  const failBoss = async () => {
    if (!activeBoss) return;
    try {
      await axios.post(
        `${API}/quests/fail`,
        { quest_id: activeBoss.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActiveBoss(null);
      toast.error("[SISTEMA] Has sido derrotado por el jefe. Se te ha asignado un castigo.");
      await refreshUser();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error");
    }
  };

  return (
    <Layout>
      {/* Challenge Modal */}
      <ChallengeModal
        isOpen={!!activeBoss}
        onClose={() => setActiveBoss(null)}
        challenge={activeBoss}
        type="boss"
        onComplete={defeatBoss}
        onFail={failBoss}
      />

      {/* Shadow Earned Modal */}
      <Dialog open={!!showShadow} onOpenChange={() => setShowShadow(null)}>
        <DialogContent className="system-window border-purple-500">
          <div className="text-center py-8">
            <Ghost className="w-20 h-20 text-purple-500 mx-auto animate-pulse" />
            <h2 className="text-3xl font-black text-purple-400 mt-4">¡SOMBRA EXTRAÍDA!</h2>
            <p className="text-slate-400 mt-2">"Levántate"</p>
            <p className="text-white text-2xl mt-4 font-bold">{showShadow?.name}</p>
            <div className={`inline-block px-4 py-2 mt-3 text-sm font-bold rarity-${showShadow?.rarity} border`}>
              {showShadow?.rarity?.toUpperCase()}
            </div>
            <div className="mt-4 text-sm text-slate-400">
              {showShadow?.stat_bonus && Object.entries(showShadow.stat_bonus).map(([stat, val]) => (
                <span key={stat} className="inline-block mx-2 text-green-400">+{val} {stat}</span>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Victory Modal (without shadow) */}
      <Dialog open={!!showVictory} onOpenChange={() => setShowVictory(null)}>
        <DialogContent className="system-window border-red-500">
          <div className="text-center py-8">
            <Swords className="w-16 h-16 text-red-500 mx-auto" />
            <h2 className="text-3xl font-black text-red-400 mt-4">¡JEFE DERROTADO!</h2>
            <div className="space-y-2 mt-4">
              <p className="text-green-400 text-xl">+{showVictory?.exp_gained} EXP</p>
              <p className="text-yellow-400 text-xl">+{showVictory?.gold_gained} Oro</p>
              {showVictory?.level_up && (
                <p className="text-blue-400 text-xl animate-pulse">¡SUBISTE DE NIVEL!</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div data-testid="bosses-page" className="space-y-6">
        <div className="flex items-center gap-4">
          <Swords className="w-8 h-8 text-red-500" />
          <h1 className="text-3xl font-black text-white uppercase">Jefes</h1>
        </div>

        <div className="quest-card p-4 border-red-500/30 bg-red-950/20">
          <p className="text-red-300">
            <strong>⚔️ Combate de Jefes:</strong> Los jefes son los enemigos más poderosos. Deberás completar ejercicios EXTREMOS para derrotarlos. 
            ¡Al vencerlos podrás extraer su sombra y añadirla a tu ejército!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {bosses.map((boss) => (
            <div 
              key={boss.id} 
              className={`quest-card p-6 border-2 card-hover ${boss.already_defeated ? 'border-green-500/30 opacity-75' : `difficulty-${boss.difficulty.toLowerCase()}`}`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold text-white">{boss.name}</h3>
                <div className={`rank-badge rank-badge-${boss.difficulty.toLowerCase()}`}>
                  {boss.difficulty}
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-4">{boss.description}</p>
              <p className="text-slate-500 text-xs mb-4">Nivel mínimo: {boss.min_level}</p>

              <div className="space-y-2 mb-4">
                {boss.exercises.map((ex, i) => (
                  <div key={i} className="flex justify-between items-center p-2 bg-red-950/30 border border-red-500/20">
                    <div className="flex items-center gap-2">
                      <Dumbbell className="w-4 h-4 text-red-400" />
                      <span className="text-white">{ex.name}</span>
                    </div>
                    <span className="text-red-400 font-mono font-bold">{ex.reps} {ex.unit}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-sm mb-4">
                <span className="text-green-400">+{boss.exp_reward} EXP</span>
                <span className="text-yellow-400">+{boss.gold_reward} Oro</span>
                {boss.shadow_reward && (
                  <span className="text-purple-400 flex items-center gap-1">
                    <Ghost className="w-4 h-4" /> Sombra
                  </span>
                )}
              </div>

              {boss.already_defeated ? (
                <div className="text-center py-3 text-green-400 font-bold border border-green-500/30 bg-green-500/10">
                  ✓ DERROTADO
                </div>
              ) : (
                <Button
                  data-testid={`fight-boss-${boss.id}`}
                  onClick={() => setActiveBoss(boss)}
                  className="btn-system w-full border-red-500/50 text-red-400 hover:bg-red-500/10"
                >
                  <Swords className="w-4 h-4 mr-2" />
                  ¡DESAFIAR AL JEFE!
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

// Shadows Page
const ShadowsPage = () => {
  const { token, user } = useAuth();
  const [shadows, setShadows] = useState([]);

  useEffect(() => {
    const fetchShadows = async () => {
      try {
        const res = await axios.get(`${API}/shadows`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setShadows(res.data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchShadows();
  }, [token]);

  const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'divine'];
  const groupedShadows = shadows.reduce((acc, s) => {
    if (!acc[s.rarity]) acc[s.rarity] = [];
    acc[s.rarity].push(s);
    return acc;
  }, {});

  const ownedCount = shadows.filter(s => s.owned).length;

  return (
    <Layout>
      <div data-testid="shadows-page" className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Ghost className="w-8 h-8 text-purple-500" />
            <h1 className="text-3xl font-black text-white uppercase">Ejército de Sombras</h1>
          </div>
          <div className="text-slate-400">
            Colección: <span className="text-purple-400 font-bold">{ownedCount}</span> / {shadows.length}
          </div>
        </div>

        <p className="text-slate-400">Colecciona sombras derrotando jefes y completando misiones especiales. Cada sombra otorga bonificaciones permanentes a tus estadísticas.</p>

        {rarityOrder.map(rarity => (
          groupedShadows[rarity] && (
            <div key={rarity} className="space-y-4">
              <h2 className={`text-lg font-bold uppercase rarity-${rarity}`}>
                {rarity} ({groupedShadows[rarity].filter(s => s.owned).length}/{groupedShadows[rarity].length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedShadows[rarity].map((shadow) => (
                  <div 
                    key={shadow.id} 
                    className={`quest-card p-4 ${shadow.owned ? `border-2 rarity-border-${shadow.rarity}` : 'opacity-40'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Ghost className={`w-10 h-10 ${shadow.owned ? `rarity-${shadow.rarity}` : 'text-slate-600'}`} />
                      <div>
                        <h3 className="text-white font-bold">{shadow.name}</h3>
                        <div className={`text-xs uppercase font-bold rarity-${shadow.rarity}`}>
                          {shadow.rarity}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-sm">
                      {Object.entries(shadow.stat_bonus).map(([stat, val]) => (
                        <span key={stat} className={`inline-block mr-2 ${shadow.owned ? 'text-green-400' : 'text-slate-500'}`}>
                          +{val} {stat}
                        </span>
                      ))}
                    </div>
                    {!shadow.owned && (
                      <div className="mt-2 text-slate-500 text-xs flex items-center gap-1">
                        <Lock className="w-3 h-3" /> No obtenida
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        ))}
      </div>
    </Layout>
  );
};

// Profile Page
const ProfilePage = () => {
  const { user, token, refreshUser } = useAuth();
  const [achievements, setAchievements] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [achRes, statsRes] = await Promise.all([
          axios.get(`${API}/achievements`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API}/user/stats`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        setAchievements(achRes.data);
        setStats(statsRes.data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchData();
  }, [token]);

  const upgradeStat = async (statName) => {
    try {
      await axios.post(
        `${API}/user/upgrade-stat`,
        { stat_name: statName, points: 1 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`[SISTEMA] ${statName} aumentada`);
      await refreshUser();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error");
    }
  };

  if (!user) return <LoadingScreen />;

  const statsList = [
    { key: "strength", label: "Fuerza", icon: Sword, color: "text-red-400" },
    { key: "endurance", label: "Resistencia", icon: Shield, color: "text-green-400" },
    { key: "agility", label: "Agilidad", icon: Zap, color: "text-blue-400" },
    { key: "vitality", label: "Vitalidad", icon: Heart, color: "text-yellow-400" },
  ];

  // Group achievements by category
  const achievementCategories = achievements.reduce((acc, a) => {
    const cat = a.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(a);
    return acc;
  }, {});

  return (
    <Layout>
      <div data-testid="profile-page" className="space-y-6">
        {/* Header */}
        <div className="quest-card p-8">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className={`w-24 h-24 bg-slate-800 flex items-center justify-center text-4xl font-black rank-${user.rank.toLowerCase()}`}>
              {user.rank}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-black text-white">{user.hunter_name}</h1>
              <p className="text-blue-400 mt-1">{user.title}</p>
              <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
                <span className="text-slate-400">Nivel <span className="text-white font-bold">{user.level}</span></span>
                <span className="text-slate-400">Misiones <span className="text-white font-bold">{user.quests_completed}</span></span>
                <span className="text-slate-400">Oro <span className="text-yellow-400 font-bold">{user.gold}</span></span>
                <span className="text-slate-400">Racha <span className="text-orange-400 font-bold">{user.streak} días</span></span>
                <span className="text-slate-400">Mejor Racha <span className="text-orange-400 font-bold">{user.best_streak} días</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="quest-card p-6">
            <h2 className="text-xl font-bold text-white uppercase mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" /> Estadísticas Detalladas
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-slate-900/50 border border-slate-800">
                <TrendingUp className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{stats.total_reps}</div>
                <div className="text-slate-500 text-xs">Repeticiones Totales</div>
              </div>
              <div className="text-center p-4 bg-slate-900/50 border border-slate-800">
                <Calendar className="w-6 h-6 text-green-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{stats.days_since_start}</div>
                <div className="text-slate-500 text-xs">Días como Cazador</div>
              </div>
              <div className="text-center p-4 bg-slate-900/50 border border-slate-800">
                <Skull className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">
                  {Object.values(stats.dungeons_completed).reduce((a, b) => a + b, 0)}
                </div>
                <div className="text-slate-500 text-xs">Mazmorras Completadas</div>
              </div>
              <div className="text-center p-4 bg-slate-900/50 border border-slate-800">
                <Award className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{stats.achievements_unlocked}/{stats.total_achievements}</div>
                <div className="text-slate-500 text-xs">Logros</div>
              </div>
            </div>
          </div>
        )}

        {/* Stats with upgrade */}
        <div className="quest-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white uppercase">Estadísticas</h2>
            {user.stat_points > 0 && (
              <span className="text-blue-400 font-bold">Puntos disponibles: {user.stat_points}</span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {statsList.map((stat) => (
              <div key={stat.key} className="flex items-center gap-4 p-4 bg-slate-900/50 border border-slate-800">
                <stat.icon className={`w-8 h-8 ${stat.color}`} />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 uppercase text-sm">{stat.label}</span>
                    <span className="text-white font-bold text-xl">
                      {user.stats[stat.key]}
                      {user.shadow_bonuses?.[stat.key] > 0 && (
                        <span className="text-purple-400 text-sm ml-1">(+{user.shadow_bonuses[stat.key]})</span>
                      )}
                    </span>
                  </div>
                </div>
                {user.stat_points > 0 && (
                  <Button
                    data-testid={`upgrade-${stat.key}`}
                    onClick={() => upgradeStat(stat.key)}
                    className="btn-system text-sm px-3 py-1"
                  >
                    +1
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Achievements */}
        <div className="quest-card p-6">
          <h2 className="text-xl font-bold text-white uppercase mb-6">Logros</h2>
          
          <Tabs defaultValue="quests" className="space-y-4">
            <TabsList className="bg-slate-900 border border-blue-500/20 flex-wrap h-auto">
              <TabsTrigger value="quests">Misiones</TabsTrigger>
              <TabsTrigger value="level">Nivel</TabsTrigger>
              <TabsTrigger value="streak">Racha</TabsTrigger>
              <TabsTrigger value="dungeon">Mazmorras</TabsTrigger>
              <TabsTrigger value="boss">Jefes</TabsTrigger>
              <TabsTrigger value="shadow">Sombras</TabsTrigger>
            </TabsList>

            {Object.keys(achievementCategories).map(category => (
              <TabsContent key={category} value={category}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {achievementCategories[category]?.map((ach) => (
                    <div 
                      key={ach.id} 
                      className={`achievement-card p-4 border border-slate-700 ${ach.unlocked ? "unlocked bg-slate-900" : "locked bg-slate-950"}`}
                    >
                      <div className="flex items-center gap-3">
                        {ach.unlocked ? (
                          <Unlock className="w-6 h-6 text-yellow-500" />
                        ) : (
                          <Lock className="w-6 h-6 text-slate-600" />
                        )}
                        <div>
                          <h4 className="text-white font-bold">{ach.name}</h4>
                          <p className="text-slate-400 text-sm">{ach.description}</p>
                          <p className="text-yellow-400 text-xs mt-1">+{ach.reward_gold} Oro</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </Layout>
  );
};

// Shop Page
const ShopPage = () => {
  const { user, token, refreshUser } = useAuth();
  const [items, setItems] = useState([]);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await axios.get(`${API}/shop/items`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setItems(res.data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchItems();
  }, [token]);

  const buyItem = async (itemId) => {
    try {
      const res = await axios.post(
        `${API}/shop/buy`,
        { item_id: itemId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`[SISTEMA] ${res.data.message}`);
      await refreshUser();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error");
    }
  };

  return (
    <Layout>
      <div data-testid="shop-page" className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ShoppingBag className="w-8 h-8 text-yellow-500" />
            <h1 className="text-3xl font-black text-white uppercase">Tienda del Sistema</h1>
          </div>
          <div className="text-yellow-400 font-bold text-xl">{user?.gold} Oro</div>
        </div>

        {user?.streak_shields > 0 && (
          <div className="quest-card p-4 border-green-500/30 flex items-center gap-3">
            <Shield className="w-6 h-6 text-green-400" />
            <span className="text-green-400">Tienes {user.streak_shields} Escudo(s) de Racha activos</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <div key={item.id} className="quest-card p-6 card-hover">
              <h3 className="text-lg font-bold text-white mb-2">{item.name}</h3>
              <p className="text-slate-400 text-sm mb-4">{item.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-yellow-400 font-bold">{item.price} Oro</span>
                <Button
                  data-testid={`buy-${item.id}`}
                  onClick={() => buyItem(item.id)}
                  disabled={user?.gold < item.price}
                  className="btn-system text-sm"
                >
                  Comprar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

// Guilds Page
const GuildsPage = () => {
  const { user, token, refreshUser } = useAuth();
  const [guilds, setGuilds] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [guildName, setGuildName] = useState("");
  const [guildDesc, setGuildDesc] = useState("");
  const [userGuild, setUserGuild] = useState(null);

  const fetchGuilds = async () => {
    try {
      const res = await axios.get(`${API}/guilds`);
      setGuilds(res.data);
      if (user?.guild_id) {
        const guildRes = await axios.get(`${API}/guilds/${user.guild_id}`);
        setUserGuild(guildRes.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchGuilds();
  }, [user?.guild_id]);

  const createGuild = async () => {
    try {
      await axios.post(
        `${API}/guilds/create`,
        { name: guildName, description: guildDesc },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("[SISTEMA] Gremio creado");
      setShowCreate(false);
      setGuildName("");
      setGuildDesc("");
      await refreshUser();
      await fetchGuilds();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error");
    }
  };

  const joinGuild = async (guildId) => {
    try {
      await axios.post(
        `${API}/guilds/join`,
        { guild_id: guildId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("[SISTEMA] Te has unido al gremio");
      await refreshUser();
      await fetchGuilds();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error");
    }
  };

  const leaveGuild = async () => {
    try {
      await axios.post(
        `${API}/guilds/leave`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("[SISTEMA] Has abandonado el gremio");
      setUserGuild(null);
      await refreshUser();
      await fetchGuilds();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error");
    }
  };

  return (
    <Layout>
      <div data-testid="guilds-page" className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Users className="w-8 h-8 text-green-500" />
            <h1 className="text-3xl font-black text-white uppercase">Gremios</h1>
          </div>
          {!user?.guild_id && (
            <Button
              data-testid="create-guild-btn"
              onClick={() => setShowCreate(true)}
              className="btn-system"
            >
              Crear Gremio
            </Button>
          )}
        </div>

        {userGuild && (
          <div className="quest-card p-6 border-green-500/30">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-green-400">Tu Gremio: {userGuild.name}</h2>
              <Button onClick={leaveGuild} className="btn-system text-red-400 border-red-500/50">
                Abandonar
              </Button>
            </div>
            <p className="text-slate-400 mb-4">{userGuild.description}</p>
            <div className="flex items-center gap-6 text-sm">
              <span className="text-slate-400">Líder: <span className="text-white">{userGuild.leader_name}</span></span>
              <span className="text-slate-400">Miembros: <span className="text-white">{userGuild.member_count}</span></span>
              <span className="text-slate-400">Nivel Total: <span className="text-blue-400">{userGuild.total_level}</span></span>
            </div>
            {userGuild.members_info && (
              <div className="mt-4 pt-4 border-t border-slate-800">
                <h4 className="text-slate-400 text-sm mb-2">Miembros:</h4>
                <div className="flex flex-wrap gap-2">
                  {userGuild.members_info.map((m) => (
                    <span key={m.id} className="px-3 py-1 bg-slate-800 text-slate-300 text-sm">
                      {m.hunter_name} (Nv.{m.level})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!user?.guild_id && (
          <div className="space-y-4">
            {guilds.length === 0 ? (
              <div className="quest-card p-8 text-center">
                <p className="text-slate-400">No hay gremios disponibles. ¡Crea el primero!</p>
              </div>
            ) : (
              guilds.map((guild) => (
                <div key={guild.id} className="quest-card p-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">{guild.name}</h3>
                    <p className="text-slate-400 text-sm">{guild.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className="text-slate-500">Líder: {guild.leader_name}</span>
                      <span className="text-slate-500">Miembros: {guild.member_count}</span>
                    </div>
                  </div>
                  <Button
                    data-testid={`join-guild-${guild.id}`}
                    onClick={() => joinGuild(guild.id)}
                    className="btn-system"
                  >
                    Unirse
                  </Button>
                </div>
              ))
            )}
          </div>
        )}

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="system-window">
            <DialogHeader>
              <DialogTitle className="text-white">Crear Gremio</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="block text-slate-400 text-sm mb-2">Nombre del Gremio</label>
                <Input
                  data-testid="guild-name-input"
                  value={guildName}
                  onChange={(e) => setGuildName(e.target.value)}
                  className="input-system w-full"
                  placeholder="Sombras del Monarca"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">Descripción</label>
                <Input
                  data-testid="guild-desc-input"
                  value={guildDesc}
                  onChange={(e) => setGuildDesc(e.target.value)}
                  className="input-system w-full"
                  placeholder="Un gremio para los más fuertes..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowCreate(false)} className="btn-system">Cancelar</Button>
              <Button onClick={createGuild} className="btn-system-solid">Crear</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

// Ranking Page
const RankingPage = () => {
  const { user } = useAuth();
  const [hunters, setHunters] = useState([]);
  const [guildRanking, setGuildRanking] = useState([]);
  const [tab, setTab] = useState("hunters");

  useEffect(() => {
    const fetchRanking = async () => {
      try {
        const [huntersRes, guildsRes] = await Promise.all([
          axios.get(`${API}/ranking`),
          axios.get(`${API}/ranking/guilds`)
        ]);
        setHunters(huntersRes.data);
        setGuildRanking(guildsRes.data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchRanking();
  }, []);

  return (
    <Layout>
      <div data-testid="ranking-page" className="space-y-6">
        <div className="flex items-center gap-4">
          <Trophy className="w-8 h-8 text-yellow-500" />
          <h1 className="text-3xl font-black text-white uppercase">Ranking Global</h1>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="bg-slate-900 border border-blue-500/20">
            <TabsTrigger value="hunters" className="data-[state=active]:bg-blue-500/20">Cazadores</TabsTrigger>
            <TabsTrigger value="guilds" className="data-[state=active]:bg-green-500/20">Gremios</TabsTrigger>
          </TabsList>

          <TabsContent value="hunters">
            <div className="quest-card overflow-hidden">
              <div className="grid grid-cols-12 gap-4 p-4 bg-slate-900 text-slate-400 text-sm uppercase tracking-wider">
                <div className="col-span-1">#</div>
                <div className="col-span-4">Cazador</div>
                <div className="col-span-2 text-center">Nivel</div>
                <div className="col-span-2 text-center">Rango</div>
                <div className="col-span-2 text-center">Racha</div>
                <div className="col-span-1 text-center">Mis.</div>
              </div>
              {hunters.map((hunter, i) => (
                <div 
                  key={hunter.id} 
                  className={`grid grid-cols-12 gap-4 p-4 border-t border-slate-800 ${hunter.id === user?.id ? "bg-blue-500/10" : ""}`}
                >
                  <div className="col-span-1 font-bold text-slate-500">
                    {i === 0 ? <Star className="w-5 h-5 text-yellow-500" /> : i + 1}
                  </div>
                  <div className="col-span-4">
                    <span className="text-white font-medium">{hunter.hunter_name}</span>
                    <span className="text-slate-500 text-sm ml-2 hidden md:inline">{hunter.title}</span>
                  </div>
                  <div className="col-span-2 text-center text-white font-bold">{hunter.level}</div>
                  <div className="col-span-2 text-center">
                    <span className={`rank-badge rank-badge-${hunter.rank.toLowerCase()}`}>{hunter.rank}</span>
                  </div>
                  <div className="col-span-2 text-center">
                    {hunter.streak > 0 && (
                      <span className="text-orange-400 flex items-center justify-center gap-1">
                        <Flame className="w-4 h-4" /> {hunter.streak}
                      </span>
                    )}
                  </div>
                  <div className="col-span-1 text-center text-slate-400">{hunter.quests_completed}</div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="guilds">
            <div className="quest-card overflow-hidden">
              <div className="grid grid-cols-12 gap-4 p-4 bg-slate-900 text-slate-400 text-sm uppercase tracking-wider">
                <div className="col-span-1">#</div>
                <div className="col-span-5">Gremio</div>
                <div className="col-span-2 text-center">Miembros</div>
                <div className="col-span-2 text-center">Nivel Total</div>
                <div className="col-span-2 text-center">Líder</div>
              </div>
              {guildRanking.map((guild, i) => (
                <div key={guild.id} className="grid grid-cols-12 gap-4 p-4 border-t border-slate-800">
                  <div className="col-span-1 font-bold text-slate-500">
                    {i === 0 ? <Star className="w-5 h-5 text-yellow-500" /> : i + 1}
                  </div>
                  <div className="col-span-5 text-white font-medium">{guild.name}</div>
                  <div className="col-span-2 text-center text-slate-400">{guild.member_count}</div>
                  <div className="col-span-2 text-center text-blue-400 font-bold">{guild.total_level}</div>
                  <div className="col-span-2 text-center text-slate-400">{guild.leader_name}</div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

// Main App
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster 
          position="top-center" 
          toastOptions={{
            className: "system-notification glass border border-blue-500/30",
            style: {
              background: "rgba(2, 6, 23, 0.95)",
              color: "white",
              border: "1px solid rgba(59, 130, 246, 0.3)"
            }
          }}
        />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/quests" element={<ProtectedRoute><QuestsPage /></ProtectedRoute>} />
          <Route path="/dungeons" element={<ProtectedRoute><DungeonsPage /></ProtectedRoute>} />
          <Route path="/bosses" element={<ProtectedRoute><BossesPage /></ProtectedRoute>} />
          <Route path="/shadows" element={<ProtectedRoute><ShadowsPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/shop" element={<ProtectedRoute><ShopPage /></ProtectedRoute>} />
          <Route path="/guilds" element={<ProtectedRoute><GuildsPage /></ProtectedRoute>} />
          <Route path="/ranking" element={<ProtectedRoute><RankingPage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
