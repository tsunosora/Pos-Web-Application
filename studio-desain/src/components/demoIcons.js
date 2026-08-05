// Icon map untuk demo/kategori yang ikonnya direferensikan by-name (string di data).
// PENTING: jangan pakai `import * as Icons from 'lucide-react'` — itu memaksa
// SELURUH library (1500+ ikon, ratusan KB) masuk bundle dan bikin loading lama
// di HP. Map eksplisit ini hanya membawa ikon yang benar-benar dipakai.
import {
  // categories.js (48 kategori demo)
  Baby, Bike, BookOpen, Bot, Briefcase, Building, CalendarDays, Camera, Car,
  Cloud, Coffee, Dumbbell, Flame, Flower, Gamepad2, Gem, GraduationCap, Heart,
  Home, Hotel, Leaf, Mic, Moon, Network, Paperclip, PawPrint, Plane, Printer,
  Rocket, Scissors, Shirt, ShoppingBag, Smartphone, Snowflake, Sofa, Sparkles,
  Stethoscope, Store, TrendingUp, Tv, User, UtensilsCrossed, Vote,
  // carouselDemos.js
  GitCompareArrows, Newspaper, Tag,
  // menuFBDemos.js
  Cake, Cookie, Fish, IceCream, Salad, Soup, Wheat,
} from 'lucide-react';

export const DEMO_ICONS = {
  Baby, Bike, BookOpen, Bot, Briefcase, Building, CalendarDays, Camera, Car,
  Cloud, Coffee, Dumbbell, Flame, Flower, Gamepad2, Gem, GraduationCap, Heart,
  Home, Hotel, Leaf, Mic, Moon, Network, Paperclip, PawPrint, Plane, Printer,
  Rocket, Scissors, Shirt, ShoppingBag, Smartphone, Snowflake, Sofa, Sparkles,
  Stethoscope, Store, TrendingUp, Tv, User, UtensilsCrossed, Vote,
  GitCompareArrows, Newspaper, Tag,
  Cake, Cookie, Fish, IceCream, Salad, Soup, Wheat,
};

/** Ambil komponen ikon by-name; fallback aman kalau nama tidak terdaftar. */
export function getDemoIcon(name, fallback = Sparkles) {
  return DEMO_ICONS[name] || fallback;
}
