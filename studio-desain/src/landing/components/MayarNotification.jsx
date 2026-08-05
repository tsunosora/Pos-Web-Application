import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { CONFIG } from '../../config.js';

// Pool nama random — di-mask: hanya 4 huruf pertama lalu ********@gmail.com
const NAME_POOL = [
  'rajendra', 'andini', 'farhan', 'putri', 'mahendra', 'salsabila', 'reza',
  'kayla', 'bagas', 'najwa', 'fauzan', 'shafira', 'yusuf', 'asmara', 'rendy',
  'tasya', 'ramadhan', 'aurelia', 'haikal', 'gabriela', 'arif', 'meilani',
  'nabilla', 'iqbal', 'dimas', 'wulandari', 'aditya', 'kirana', 'fajar',
  'shinta', 'rafi', 'amara', 'galang', 'caca', 'evan', 'naura',
  'satria', 'cindy', 'ridho', 'tania', 'bima', 'vanya',
];

const VISIBLE_MS = 3000;
const HIDDEN_MS  = 3000;

let LAST_PREFIX = '';
function maskedEmail() {
  let head, tries = 0;
  do {
    const name = NAME_POOL[Math.floor(Math.random() * NAME_POOL.length)];
    head = name.slice(0, 4);
    tries++;
  } while (head === LAST_PREFIX && tries < 8);
  LAST_PREFIX = head;
  return `${head}*********@gmail.com`;
}

function initial(email) {
  return email.charAt(0).toUpperCase();
}

const AVATAR_COLORS = [
  { from: '#10b981', to: '#059669' }, // emerald
  { from: '#3b82f6', to: '#1d4ed8' }, // blue
  { from: '#f59e0b', to: '#d97706' }, // amber
  { from: '#ec4899', to: '#be185d' }, // pink
  { from: '#8b5cf6', to: '#6d28d9' }, // violet
  { from: '#ef4444', to: '#b91c1c' }, // red
];

export default function MayarNotification() {
  const [item, setItem]       = useState(() => makeItem());
  const [visible, setVisible] = useState(false);

  function makeItem() {
    const email = maskedEmail();
    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    return { email, color, key: Date.now() + Math.random() };
  }

  useEffect(() => {
    // Show first toast after small delay
    let visTimer, hideTimer;
    const cycle = () => {
      setItem(makeItem());
      setVisible(true);
      visTimer = setTimeout(() => {
        setVisible(false);
        hideTimer = setTimeout(cycle, HIDDEN_MS);
      }, VISIBLE_MS);
    };
    const initial = setTimeout(cycle, 1200);
    return () => {
      clearTimeout(initial);
      clearTimeout(visTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className={`fixed z-[60] left-3 sm:left-5 top-16 sm:top-20 max-w-[270px] sm:max-w-[320px] pointer-events-none mayar-notif ${visible ? 'is-visible' : 'is-hidden'}`}
    >
      <div
        key={item.key}
        className="mayar-notif-card pointer-events-auto inline-flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white text-zinc-900 shadow-2xl border border-zinc-200"
        style={{ boxShadow: '0 18px 50px -12px rgba(0,0,0,0.45), 0 4px 16px -4px rgba(0,0,0,0.18)' }}
      >
        {/* Avatar */}
        <div
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg shrink-0 flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-inner"
          style={{ background: `linear-gradient(135deg, ${item.color.from}, ${item.color.to})` }}
        >
          {initial(item.email)}
        </div>
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="text-[12px] sm:text-[13px] font-semibold text-zinc-900 truncate leading-tight">
            {item.email}
          </div>
          <div className="text-[10px] sm:text-[11px] text-zinc-600 leading-tight mt-0.5 truncate">
            Membeli {CONFIG.brandName}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[9px] sm:text-[10px] text-zinc-500">
            <ShieldCheck className="w-2.5 h-2.5 text-blue-600" strokeWidth={2.5} />
            <span>
              Verified by <span className="font-bold text-blue-600">Mayar</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
