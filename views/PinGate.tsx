import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Lock, ShieldCheck, HelpCircle, AlertCircle, ArrowRight, UserCheck, RefreshCw, KeyRound, Eye, EyeOff } from 'lucide-react';
import { UserProfile } from '../types';

interface PinGateProps {
  user: UserProfile;
  isUnlocked: boolean;
  onUnlock: () => void;
  onUpdateUser: (updatedUser: UserProfile) => Promise<void>;
}

const SECURITY_QUESTIONS = [
  "¿Cuál es el nombre de tu primera mascota?",
  "¿En qué ciudad nacieron tus padres?",
  "¿Cuál es tu comida favorita de la infancia?",
  "¿Cuál fue el nombre de tu primera escuela?",
  "¿Cuál es tu color de auto preferido?",
  "¿Nombre de un familiar cercano o amigo de confianza?"
];

const PinGate: React.FC<PinGateProps> = ({ user, onUnlock, onUpdateUser }) => {
  const [step, setStep] = useState<'challenge' | 'setup' | 'recovery_choice' | 'recovery_question' | 'recovery_password'>('challenge');
  const [pin, setPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  
  // Setup fields
  const [selectedQuestion, setSelectedQuestion] = useState<string>(SECURITY_QUESTIONS[0]);
  const [customQuestion, setCustomQuestion] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [recoveryAnswerInput, setRecoveryAnswerInput] = useState<string>('');
  
  // Verification/Answer states
  const [answerInput, setAnswerInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Password recovery state (recovery_password)
  const [accountPassword, setAccountPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Determine if user already has a PIN
  // We check both database property and localStorage as a fallback
  const userHasPin = !!user.dashboardPin || !!localStorage.getItem(`cajapro_pin_${user.id}`);
  const currentPin = user.dashboardPin || localStorage.getItem(`cajapro_pin_${user.id}`) || '';
  const currentQuestion = user.recoveryQuestion || localStorage.getItem(`cajapro_rec_q_${user.id}`) || '';
  const currentAnswer = user.recoveryAnswer || localStorage.getItem(`cajapro_rec_a_${user.id}`) || '';

  useEffect(() => {
    if (!userHasPin) {
      setStep('setup');
    } else {
      setStep('challenge');
    }
    setPin('');
    setConfirmPin('');
    setErrorMsg('');
    setSuccessMsg('');
  }, [user.id, userHasPin]);

  const handleKeyPress = (num: string) => {
    setErrorMsg('');
    if (step === 'challenge') {
      if (pin.length < 4) {
        const nextPin = pin + num;
        setPin(nextPin);
        if (nextPin.length === 4) {
          // Automatic verify on 4th digit
          verifyChallengePin(nextPin);
        }
      }
    } else if (step === 'setup') {
      if (pin.length < 4) {
        setPin(pin + num);
      } else if (confirmPin.length < 4) {
        setConfirmPin(confirmPin + num);
      }
    }
  };

  const handleDelete = () => {
    setErrorMsg('');
    if (step === 'challenge') {
      setPin(pin.slice(0, -1));
    } else if (step === 'setup') {
      if (confirmPin.length > 0) {
        setConfirmPin(confirmPin.slice(0, -1));
      } else {
        setPin(pin.slice(0, -1));
      }
    }
  };

  const handleClear = () => {
    setPin('');
    setConfirmPin('');
    setErrorMsg('');
  };

  const verifyChallengePin = (pinToVerify: string) => {
    if (pinToVerify === currentPin) {
      onUnlock();
    } else {
      setTimeout(() => {
        setErrorMsg('PIN incorrecto. Inténtalo de nuevo.');
        setPin('');
      }, 300);
    }
  };

  // Keyboard entry support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, confirmPin, step]);

  const handleCreatePinAndRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (pin.length !== 4) {
      setErrorMsg('El PIN debe tener exactamente 4 dígitos.');
      return;
    }

    if (pin !== confirmPin) {
      setErrorMsg('Los PINs ingresados no coinciden.');
      return;
    }

    const finalQuestion = isCustom ? customQuestion.trim() : selectedQuestion;
    const finalAnswer = recoveryAnswerInput.trim().toLowerCase();

    if (!finalQuestion) {
      setErrorMsg('Por favor escribe o selecciona una pregunta de recuperación.');
      return;
    }

    if (!finalAnswer) {
      setErrorMsg('Por favor escribe la respuesta de recuperación.');
      return;
    }

    setLoading(true);
    try {
      // Intenta actualizar base de datos
      const updatedUser: UserProfile = {
        ...user,
        dashboardPin: pin,
        recoveryQuestion: finalQuestion,
        recoveryAnswer: finalAnswer,
      };

      // Respalda localmente de inmediato para máxima robustez
      localStorage.setItem(`cajapro_pin_${user.id}`, pin);
      localStorage.setItem(`cajapro_rec_q_${user.id}`, finalQuestion);
      localStorage.setItem(`cajapro_rec_a_${user.id}`, finalAnswer);

      try {
        await onUpdateUser(updatedUser);
      } catch (dbErr: any) {
        console.warn("DB update failed, using localStorage backup mechanism for security pin:", dbErr);
        // We log it but proceed because local recovery is active
      }

      setSuccessMsg('¡PIN de seguridad configurado exitosamente!');
      setTimeout(() => {
        onUnlock();
      }, 1500);

    } catch (err: any) {
      setErrorMsg('Error al guardar la configuración: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyQuestion = () => {
    setErrorMsg('');
    const inputAnswerClean = answerInput.trim().toLowerCase();

    if (!inputAnswerClean) {
      setErrorMsg('Por favor escribe tu respuesta.');
      return;
    }

    if (inputAnswerClean === currentAnswer.toLowerCase()) {
      setSuccessMsg('Identidad verificada. Por favor, crea un nuevo PIN.');
      setTimeout(() => {
        setPin('');
        setConfirmPin('');
        setRecoveryAnswerInput('');
        setAnswerInput('');
        setErrorMsg('');
        setSuccessMsg('');
        setStep('setup');
      }, 1500);
    } else {
      setErrorMsg('Respuesta incorrecta. Intenta con otra respuesta o utiliza la contraseña de tu cuenta.');
    }
  };

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!accountPassword) {
      setErrorMsg('Por favor ingresa la contraseña.');
      return;
    }

    setLoading(true);
    try {
      // Re-Authenticate with Supabase using email and input password to verify identity
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: accountPassword
      });

      if (authError) {
        throw new Error("Contraseña incorrecta. Verifica las credenciales de tu cuenta.");
      }

      setSuccessMsg('Contraseña de cuenta verificada correctamente.');
      setTimeout(() => {
        setPin('');
        setConfirmPin('');
        setRecoveryAnswerInput('');
        setAnswerInput('');
        setAccountPassword('');
        setErrorMsg('');
        setSuccessMsg('');
        setStep('setup');
      }, 1500);

    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 lg:p-10 animate-in fade-in duration-500">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-8 border border-slate-100 dark:border-slate-800/80 relative overflow-hidden">
        
        {/* Glow upper effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          
          {/* ICON HEADER */}
          <div className="text-center mb-8">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-xl transition-colors duration-300 ${
              step === 'setup' 
                ? 'bg-emerald-500/10 text-emerald-500 shadow-emerald-500/5' 
                : step.startsWith('recovery') 
                ? 'bg-amber-500/10 text-amber-500 shadow-amber-500/5' 
                : 'bg-blue-500/10 text-blue-500 shadow-blue-500/5'
            }`}>
              {step === 'setup' ? (
                <ShieldCheck size={32} />
              ) : step.startsWith('recovery') ? (
                <HelpCircle size={32} />
              ) : (
                <Lock size={32} />
              )}
            </div>
            
            <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100">
              {step === 'challenge' && 'PIN de Seguridad'}
              {step === 'setup' && 'Configura tu PIN'}
              {step === 'recovery_choice' && 'Recuperar PIN'}
              {step === 'recovery_question' && 'Pregunta de Seguridad'}
              {step === 'recovery_password' && 'Verificar Contraseña'}
            </h1>
            
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1.5 leading-relaxed">
              {step === 'challenge' && 'El panel de control contiene datos sensibles.'}
              {step === 'setup' && 'Crea un PIN de 4 dígitos para proteger el Dashboard.'}
              {step === 'recovery_choice' && 'Elige un método para restablecer tu PIN de 4 dígitos.'}
              {step === 'recovery_question' && 'Responde la pregunta configurada para tu usuario.'}
              {step === 'recovery_password' && 'Ingresa la contraseña de tu cuenta para continuar.'}
            </p>
          </div>

          {/* STATUS NOTIFICATIONS */}
          {errorMsg && (
            <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-2xl flex items-start gap-2.5 animate-bounce-short">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-2xl flex items-start gap-2.5 animate-pulse">
              <ShieldCheck size={16} className="flex-shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* STEP 1: CHALLENGE */}
          {step === 'challenge' && (
            <div className="space-y-8">
              {/* Digit Dot indicators */}
              <div className="flex justify-center items-center gap-6 my-4">
                {[...Array(4)].map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-4 h-4 rounded-full transition-all duration-200 border-2 ${
                      i < pin.length 
                        ? 'bg-blue-600 dark:bg-blue-500 border-blue-600 dark:border-blue-500 scale-125 shadow-lg shadow-blue-500/40' 
                        : 'bg-transparent border-slate-300 dark:border-slate-700'
                    }`}
                  />
                ))}
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-4 max-w-[280px] mx-auto">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                  <button 
                    key={num}
                    onClick={() => handleKeyPress(num)}
                    className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-700/60 flex items-center justify-center font-black text-xl text-slate-700 dark:text-slate-200 active:scale-95 transition-all"
                  >
                    {num}
                  </button>
                ))}
                <button 
                  onClick={handleClear}
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 active:scale-95 transition-all uppercase tracking-wider"
                >
                  Borrar
                </button>
                <button 
                  onClick={() => handleKeyPress('0')}
                  className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-700/60 flex items-center justify-center font-black text-xl text-slate-700 dark:text-slate-200 active:scale-95 transition-all"
                >
                  0
                </button>
                <button 
                  onClick={handleDelete}
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 active:scale-95 transition-all uppercase tracking-wider"
                >
                  Elim.
                </button>
              </div>

              <div className="text-center pt-4">
                <button 
                  onClick={() => setStep('recovery_choice')}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1.5"
                >
                  ¿Olvidaste tu PIN? Recuperar PIN
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: SETUP */}
          {step === 'setup' && (
            <form onSubmit={handleCreatePinAndRecovery} className="space-y-6">
              {/* PIN Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block text-center">Nuevo PIN (4 díg.)</label>
                  <div className="flex justify-center gap-2">
                    {[...Array(4)].map((_, i) => (
                      <div 
                        key={i} 
                        className={`w-10 h-12 rounded-xl border flex items-center justify-center text-lg font-black transition-all ${
                          i < pin.length 
                            ? 'border-emerald-500 bg-emerald-500/5 text-slate-800 dark:text-slate-100' 
                            : 'border-slate-200 dark:border-slate-800 bg-transparent text-transparent'
                        }`}
                      >
                        {i < pin.length ? '●' : ''}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block text-center">Confirmar PIN</label>
                  <div className="flex justify-center gap-2">
                    {[...Array(4)].map((_, i) => (
                      <div 
                        key={i} 
                        className={`w-10 h-12 rounded-xl border flex items-center justify-center text-lg font-black transition-all ${
                          i < confirmPin.length 
                            ? 'border-emerald-500 bg-emerald-500/5 text-slate-800 dark:text-slate-100' 
                            : 'border-slate-200 dark:border-slate-800 bg-transparent text-transparent'
                        }`}
                      >
                        {i < confirmPin.length ? '●' : ''}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Minikeypad wrapper inside setup screen to make it fully visual */}
              <div className="flex justify-center gap-3">
                <button 
                  type="button" 
                  onClick={handleClear} 
                  className="text-xs font-bold px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  Limpiar PIN
                </button>
              </div>

              {/* Keypad for Setup */}
              <div className="grid grid-cols-5 gap-2 max-w-[280px] mx-auto bg-slate-50 dark:bg-slate-800/30 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                {['1','2','3','4','5','6','7','8','9','0'].map(num => (
                  <button 
                    key={num}
                    type="button"
                    onClick={() => handleKeyPress(num)}
                    className="h-10 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-700 flex items-center justify-center font-bold text-sm text-slate-700 dark:text-slate-200 active:scale-95 transition-all"
                  >
                    {num}
                  </button>
                ))}
              </div>

              {/* Recovery Question Setup */}
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-2 mb-1">
                  <UserCheck className="text-emerald-500" size={16} />
                  <span className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Recuperación ante olvidos</span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Pregunta de Seguridad</label>
                    <button 
                      type="button" 
                      onClick={() => { setIsCustom(!isCustom); setErrorMsg(''); }}
                      className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:underline"
                    >
                      {isCustom ? "Elegir de lista" : "Pregunta propia"}
                    </button>
                  </div>

                  {isCustom ? (
                    <input 
                      required 
                      type="text" 
                      placeholder="Ej: ¿Cuál es el nombre de tu película favorita?" 
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500/40 outline-none text-xs dark:text-slate-200 font-medium" 
                      value={customQuestion} 
                      onChange={(e) => setCustomQuestion(e.target.value)} 
                    />
                  ) : (
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs dark:text-slate-200 font-medium"
                      value={selectedQuestion}
                      onChange={(e) => setSelectedQuestion(e.target.value)}
                    >
                      {SECURITY_QUESTIONS.map((q, idx) => (
                        <option key={idx} value={q}>{q}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Respuesta Secreta</label>
                  <input 
                    required 
                    type="text" 
                    placeholder="Escribe tu respuesta aquí (no distingue mayúsculas)" 
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500/40 outline-none text-xs dark:text-slate-200 font-medium" 
                    value={recoveryAnswerInput} 
                    onChange={(e) => setRecoveryAnswerInput(e.target.value)} 
                  />
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-widest ml-1 mt-1">Guarda bien esta respuesta, te permitirá reiniciar el PIN en segundos.</p>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading || pin.length < 4 || confirmPin.length < 4 || !recoveryAnswerInput}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/10 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40"
              >
                {loading ? <RefreshCw className="animate-spin" size={16} /> : 'Guardar y Configurar PIN'}
                {!loading && <ArrowRight size={16} />}
              </button>
            </form>
          )}

          {/* STEP 3: RECOVERY CHOICE */}
          {step === 'recovery_choice' && (
            <div className="space-y-4">
              <button 
                type="button" 
                onClick={() => setStep('recovery_question')}
                className="w-full p-4 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-2xl flex items-center gap-4 text-left transition-all active:scale-[0.99]"
              >
                <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
                  <HelpCircle size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Pregunta de Seguridad</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">Responde la pregunta configurada.</p>
                </div>
              </button>

              <button 
                type="button" 
                onClick={() => setStep('recovery_password')}
                className="w-full p-4 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-2xl flex items-center gap-4 text-left transition-all active:scale-[0.99]"
              >
                <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Contraseña de la Cuenta</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">Usa la contraseña general con la que entraste.</p>
                </div>
              </button>

              <div className="flex justify-center pt-4">
                <button 
                  type="button" 
                  onClick={() => setStep('challenge')}
                  className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 tracking-wider"
                >
                  Volver al Teclado
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: RECOVERY BY QUESTION */}
          {step === 'recovery_question' && (
            <div className="space-y-6">
              <div className="p-4 bg-blue-50 dark:bg-slate-800/50 border border-blue-100 dark:border-slate-700 rounded-2xl">
                <span className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest block mb-1 font-sans">Pregunta actual</span>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{currentQuestion || "Sin pregunta configurada. Intenta por contraseña."}</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Tu Respuesta</label>
                <input 
                  required 
                  type="text" 
                  placeholder="Ingresa la respuesta exacta" 
                  className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500/40 outline-none text-sm dark:text-slate-200 font-medium font-sans" 
                  value={answerInput} 
                  onChange={(e) => setAnswerInput(e.target.value)} 
                />
              </div>

              <button 
                onClick={handleVerifyQuestion}
                disabled={!answerInput}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/10 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40"
              >
                Verificar Respuesta
              </button>

              <button 
                type="button" 
                onClick={() => setStep('recovery_choice')}
                className="w-full text-center text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 uppercase tracking-widest"
              >
                Elegir otro método
              </button>
            </div>
          )}

          {/* STEP 5: RECOVERY BY PASSWORD */}
          {step === 'recovery_password' && (
            <form onSubmit={handleVerifyPassword} className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Contraseña de tu Cuenta</label>
                <div className="relative">
                  <input 
                    required 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Contraseña de inicio de sesión" 
                    className="w-full pl-4 pr-12 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500/40 outline-none text-sm dark:text-slate-200 font-medium font-sans" 
                    value={accountPassword} 
                    onChange={(e) => setAccountPassword(e.target.value)} 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button  
                type="submit" 
                disabled={loading || !accountPassword}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/10 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40"
              >
                {loading ? <RefreshCw className="animate-spin" size={16} /> : 'Validar Identidad'}
                {!loading && <ArrowRight size={16} />}
              </button>

              <button 
                type="button" 
                onClick={() => setStep('recovery_choice')}
                className="w-full text-center text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 uppercase tracking-widest"
              >
                Elegir otro método
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};

export default PinGate;
