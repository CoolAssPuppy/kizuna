import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useActiveEvent } from '@/features/events/useActiveEvent';
import { getSupabaseClient } from '@/lib/supabase';

import { fetchAdminStats, type CategoryCount } from '../api/stats';

// Theme-driven 8-color palette. Each variant in globals.css defines its
// own --c-chart-1..8, so charts re-skin automatically when the user
// switches themes (light, supa, hermione, kirk, barbie).
const PALETTE = [
  'var(--c-chart-1)',
  'var(--c-chart-2)',
  'var(--c-chart-3)',
  'var(--c-chart-4)',
  'var(--c-chart-5)',
  'var(--c-chart-6)',
  'var(--c-chart-7)',
  'var(--c-chart-8)',
];

export function StatsScreen(): JSX.Element {
  const { t } = useTranslation();
  const { data: event } = useActiveEvent();
  const eventId = event?.id ?? null;

  const {
    data: stats,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['admin', 'stats', eventId],
    enabled: eventId !== null,
    queryFn: () =>
      eventId ? fetchAdminStats(getSupabaseClient(), eventId) : Promise.resolve(null),
  });

  if (isLoading) {
    return <p className="py-8 text-sm text-muted-foreground">{t('admin.loading')}</p>;
  }
  if (error) {
    return (
      <p role="alert" className="py-8 text-sm text-destructive">
        {error.message}
      </p>
    );
  }
  if (!stats) return <p className="py-8 text-sm text-muted-foreground">{t('admin.loading')}</p>;

  const funnelRows: CategoryCount[] = [
    { name: t('admin.stats.funnel.invited'), count: stats.funnel.invited },
    { name: t('admin.stats.funnel.started'), count: stats.funnel.started },
    { name: t('admin.stats.funnel.complete'), count: stats.funnel.complete },
    { name: t('admin.stats.funnel.cancelled'), count: stats.funnel.cancelled },
  ];

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{t('admin.stats.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('admin.stats.subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ChartCard
          title={t('admin.stats.funnel.title')}
          subtitle={t('admin.stats.funnel.subtitle')}
        >
          <BarHorizontal data={funnelRows} />
        </ChartCard>

        <ChartCard title={t('admin.stats.role.title')} subtitle={t('admin.stats.role.subtitle')}>
          <DonutChart data={stats.attendeesByRole} />
        </ChartCard>

        <ChartCard
          title={t('admin.stats.country.title')}
          subtitle={t('admin.stats.country.subtitle')}
        >
          <BarVertical data={stats.attendeesByCountry.slice(0, 12)} />
        </ChartCard>

        <ChartCard
          title={t('admin.stats.department.title')}
          subtitle={t('admin.stats.department.subtitle')}
        >
          <BarVertical data={stats.attendeesByDepartment} />
        </ChartCard>

        <ChartCard
          title={t('admin.stats.payments.title')}
          subtitle={t('admin.stats.payments.subtitle')}
        >
          <DonutChart data={stats.paymentStatus} />
        </ChartCard>

        <ChartCard
          title={t('admin.stats.tenure.title')}
          subtitle={t('admin.stats.tenure.subtitle')}
        >
          <BarDistribution data={stats.yearsAttended} />
        </ChartCard>

        <ChartCard
          title={t('admin.stats.dietary.title')}
          subtitle={t('admin.stats.dietary.subtitle')}
        >
          <BarVertical data={stats.dietaryRestrictions} />
        </ChartCard>

        <ChartCard
          title={t('admin.stats.allergies.title')}
          subtitle={t('admin.stats.allergies.subtitle')}
        >
          <BarVertical data={stats.allergies} />
        </ChartCard>

        <ChartCard
          title={t('admin.stats.accessibility.title')}
          subtitle={t('admin.stats.accessibility.subtitle')}
        >
          <BarVertical data={stats.accessibilityNeeds} />
        </ChartCard>

        <ChartCard
          title={t('admin.stats.alcoholFree.title')}
          subtitle={t('admin.stats.alcoholFree.subtitle')}
        >
          <SingleStat
            value={stats.alcoholFreeShare.freeOf}
            of={stats.alcoholFreeShare.total}
            label={t('admin.stats.alcoholFree.label')}
          />
        </ChartCard>
      </div>
    </section>
  );
}

interface ChartCardProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

function ChartCard({ title, subtitle, children }: ChartCardProps): JSX.Element {
  return (
    <article className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
      <header>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </header>
      <div className="h-56">{children}</div>
    </article>
  );
}

function BarVertical({ data }: { data: CategoryCount[] }): JSX.Element {
  if (data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 80, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
        <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
        <YAxis
          type="category"
          dataKey="name"
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          width={80}
        />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 6,
            fontSize: 12,
          }}
          cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
        />
        <Bar dataKey="count" fill={PALETTE[0]} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function BarDistribution({ data }: { data: CategoryCount[] }): JSX.Element {
  if (data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 24 }} barCategoryGap={1}>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
        <XAxis
          dataKey="name"
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          interval={0}
          tickFormatter={(v: string) => v}
        />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 6,
            fontSize: 12,
          }}
          cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
        />
        <Bar dataKey="count" fill={PALETTE[0]} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function BarHorizontal({ data }: { data: CategoryCount[] }): JSX.Element {
  if (data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 24 }}>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        <Bar dataKey="count" fill={PALETTE[0]} radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]!} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DonutChart({ data }: { data: CategoryCount[] }): JSX.Element {
  if (data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="name"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]!} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 6,
            fontSize: 12,
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

interface SingleStatProps {
  value: number;
  of: number;
  label: string;
}

function SingleStat({ value, of, label }: SingleStatProps): JSX.Element {
  const pct = of === 0 ? 0 : Math.round((value / of) * 100);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1">
      <div className="text-5xl font-semibold tracking-tight">{pct}%</div>
      <div className="text-xs text-muted-foreground">
        {label}: {value} / {of}
      </div>
    </div>
  );
}

function Empty(): JSX.Element {
  const { t } = useTranslation();
  return (
    <p className="flex h-full items-center justify-center text-xs text-muted-foreground">
      {t('admin.stats.empty')}
    </p>
  );
}
