import { Link } from 'react-router-dom';
import { ArrowRight, Globe, Zap, Shield, BarChart, Bell, Layers, ChevronRight } from 'lucide-react';

const Home = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="container mx-auto px-6 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">Beacon</span>
          </div>
          <nav className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-slate-300 hover:text-white transition-colors px-3 py-2">
              Login
            </Link>
            <Link 
              to="/login"
              className="text-sm font-medium px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-lg transition-all duration-200 shadow-lg shadow-indigo-500/20"
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-24 md:py-32 px-6 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/30 via-transparent to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-indigo-600/8 rounded-full blur-3xl" />
        
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-xs font-medium text-indigo-300 mb-6">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                Self-Hosted Push Platform
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
                Web Push
                <span className="block bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                  Notifications
                </span>
                at Scale
              </h1>
              <p className="text-lg text-slate-400 mb-8 max-w-lg">
                Send millions of push notifications from your own infrastructure. No third-party limits, no per-message fees, complete data ownership.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold rounded-xl shadow-xl shadow-indigo-500/25 transition-all duration-200"
                >
                  Open Dashboard
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            {/* Code preview card */}
            <div className="hidden md:block">
              <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-2xl">
                <div className="flex items-center gap-2 mb-5">
                  <div className="h-3 w-3 bg-red-500/80 rounded-full" />
                  <div className="h-3 w-3 bg-yellow-500/80 rounded-full" />
                  <div className="h-3 w-3 bg-green-500/80 rounded-full" />
                  <span className="ml-auto text-xs text-slate-500 font-mono">push-notification.js</span>
                </div>
                <div className="font-mono text-sm leading-relaxed">
                  <p><span className="text-violet-400">await</span> <span className="text-indigo-300">beacon</span>.<span className="text-yellow-300">send</span>({'{'})</p>
                  <p className="pl-4"><span className="text-slate-500">title:</span> <span className="text-emerald-400">'Welcome back! 🎉'</span>,</p>
                  <p className="pl-4"><span className="text-slate-500">body:</span> <span className="text-emerald-400">'Check out what's new'</span>,</p>
                  <p className="pl-4"><span className="text-slate-500">icon:</span> <span className="text-emerald-400">'/icon.png'</span>,</p>
                  <p className="pl-4"><span className="text-slate-500">url:</span> <span className="text-emerald-400">'https://your-site.com'</span></p>
                  <p>{'}'});</p>
                  <p className="mt-3 text-slate-600">// ✓ Sent to 12,847 subscribers in 2.3s</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="border-y border-white/5 bg-slate-900/50">
        <div className="container mx-auto max-w-5xl px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '∞', label: 'No Message Limits' },
              { value: '<2s', label: 'Delivery Speed' },
              { value: '100%', label: 'Data Ownership' },
              { value: '0', label: 'Third-Party Fees' },
            ].map((stat, i) => (
              <div key={i}>
                <p className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                  {stat.value}
                </p>
                <p className="text-xs md:text-sm text-slate-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-28 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Built for Performance</h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Everything you need to run a professional push notification service
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Globe, title: 'Multi-Website', desc: 'Manage push for unlimited websites from one dashboard.' },
              { icon: Zap, title: 'Background Workers', desc: 'BullMQ-powered async dispatch — never block the main thread.' },
              { icon: Shield, title: 'P256DH Encryption', desc: 'Direct VAPID handshakes with browser push services.' },
              { icon: BarChart, title: 'Real-Time Analytics', desc: 'Track delivery, clicks, and subscriber growth in real time.' },
              { icon: Layers, title: 'Campaign Manager', desc: 'Schedule, draft, and organize notifications into campaigns.' },
              { icon: Bell, title: 'Smart SDK', desc: 'Drop-in JavaScript SDK with customizable permission prompts.' },
            ].map((feature, i) => (
              <div
                key={i}
                className="group p-6 rounded-2xl bg-slate-900/50 border border-white/5 hover:border-indigo-500/30 transition-all duration-300 hover:bg-slate-900/80"
              >
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-4 group-hover:bg-indigo-500/20 transition-colors duration-300">
                  <feature.icon className="h-5 w-5 text-indigo-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20 px-6">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/20 to-violet-900/20" />
        <div className="container mx-auto max-w-3xl text-center relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Go?</h2>
          <p className="text-lg text-slate-400 mb-8">
            Your self-hosted push notification engine is already running.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold rounded-xl shadow-xl shadow-indigo-500/25 transition-all duration-200 text-lg"
          >
            Open Dashboard
            <ChevronRight size={20} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6 mt-auto">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                <Zap className="h-3 w-3 text-white" />
              </div>
              <span className="font-semibold text-sm">Beacon</span>
            </div>
            <p className="text-xs text-slate-600">
              © {new Date().getFullYear()} Beacon. Self-hosted web push notifications.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home; 