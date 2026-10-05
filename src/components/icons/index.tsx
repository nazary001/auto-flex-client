import type { ComponentProps, ComponentType, ReactNode } from "react";
import {
  Armchair,
  Car,
  CarFront,
  CircleDot,
  Cog,
  Cpu,
  CreditCard,
  Disc3,
  Droplet,
  Droplets,
  Fan,
  Funnel,
  Headset,
  Layers,
  LayoutGrid,
  Lightbulb,
  Luggage,
  Mountain,
  Package,
  Shield,
  ShieldCheck,
  Sofa,
  Sparkles,
  Tag,
  Truck,
  VolumeX,
  Wind,
  Zap,
} from "lucide-react";

export type IconProps = Omit<ComponentProps<"svg">, "ref">;

function IconBase({ children, strokeWidth = 2, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Engine silhouette, drawn on the lucide grid */
function EngineIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 5h5M11.5 5v3" />
      <path d="M6 8h9l2 2.5h2.5V17H17l-2 2H9.5l-2-2H6v-2.5H3.5v-3H6V8Z" />
      <path d="M19.5 13.5H22M22 11v5" />
    </IconBase>
  );
}

/** Coil spring */
function SpringIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 3h12M6 21h12" />
      <path d="m7 3 10 3-10 3 10 3-10 3 10 3-10 3" />
    </IconBase>
  );
}

const categoryIcons: Record<string, ComponentType<IconProps>> = {
  // legacy demo-catalog groups
  brakes: Disc3,
  engine: EngineIcon,
  filters: Funnel,
  suspension: SpringIcon,
  transmission: Cog,
  electrics: Zap,
  cooling: Fan,
  exhaust: Wind,
  // DD Tuning supplier groups (accessories & tuning)
  fluids: Droplet,
  soundproofing: VolumeX,
  chrome: Sparkles,
  bullbar: Shield,
  roofrack: Luggage,
  bodykit: Car,
  mats: LayoutGrid,
  mudflaps: Droplets,
  hubcaps: CircleDot,
  covers: Armchair,
  badges: Tag,
  accessories: Package,
  deflectors: Wind,
  interior: Sofa,
  lighting: Lightbulb,
  underbody: ShieldCheck,
  plastic: Layers,
  electronics: Cpu,
  body: CarFront,
  wheels: Disc3,
  lamps: Lightbulb,
  offroad: Mountain,
};

/** Icon of a top-level catalog group; `name` is `Category.icon` */
export function CategoryIcon({ name, strokeWidth = 1.75, ...props }: IconProps & { name?: string }) {
  const Icon = (name && categoryIcons[name]) || Package;
  return <Icon aria-hidden strokeWidth={strokeWidth} {...props} />;
}

const benefitIcons = {
  delivery: Truck,
  warranty: ShieldCheck,
  support: Headset,
  payment: CreditCard,
} as const;

export function BenefitIcon({ name, strokeWidth = 1.6, ...props }: IconProps & { name: keyof typeof benefitIcons }) {
  const Icon = benefitIcons[name];
  return <Icon aria-hidden strokeWidth={strokeWidth} {...props} />;
}

export type SocialName = "telegram" | "viber" | "instagram" | "facebook" | "youtube";

/** Simplified messenger / social glyphs (lucide ships no brand icons) */
export function SocialIcon({ name, ...props }: IconProps & { name: SocialName }) {
  switch (name) {
    case "telegram":
      return (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden {...props}>
          <path d="M21.4 4.6 18.3 19.1c-.2 1-.8 1.3-1.700.8l-4.700-3.500-2.300 2.200c-.2.3-.5.5-1 .5l.4-4.800 8.700-7.800c.4-.4-.1-.5-.6-.2L6.400 13 1.800 11.600c-1-.3-1-1 .2-1.500l17.900-6.900c.8-.3 1.600.2 1.500 1.400Z" />
        </svg>
      );
    case "viber":
      return (
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          {...props}
        >
          <path d="M12 2.800c-5.200 0-8.700 2.700-8.700 7.600 0 2.500.9 4.400 2.500 5.700v3.900l3.400-2.200c.9.2 1.800.3 2.800.3 5.200 0 8.700-2.800 8.700-7.700S17.200 2.800 12 2.800Z" />
          <path
            d="M9.300 7.700c.3-.3.8-.3 1 .1l.8 1.300c.2.3.1.7-.1.9l-.5.5c.5 1 1.300 1.800 2.300 2.300l.5-.5c.2-.2.6-.3.9-.1l1.300.8c.4.2.4.7.1 1-.8.8-2 1-3.200.4a8.600 8.600 0 0 1-3.500-3.500c-.6-1.200-.4-2.400.4-3.200Z"
            fill="currentColor"
            stroke="none"
          />
        </svg>
      );
    case "instagram":
      return (
        <IconBase aria-hidden strokeWidth={1.75} {...props}>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.3" cy="6.7" r="0.9" fill="currentColor" stroke="none" />
        </IconBase>
      );
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden {...props}>
          <path d="M14 8.500V7c0-.8.4-1.200 1.300-1.200H17V3h-2.400c-2.700 0-4.100 1.600-4.100 4v1.500H8v3h2.500V21H14v-9.500h2.600l.4-3H14Z" />
        </svg>
      );
    case "youtube":
      return (
        <IconBase aria-hidden strokeWidth={1.75} {...props}>
          <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
          <path d="m10 9.300 4.700 2.700-4.700 2.700V9.300Z" fill="currentColor" stroke="none" />
        </IconBase>
      );
  }
}
