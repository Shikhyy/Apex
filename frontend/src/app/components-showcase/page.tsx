"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { StatCard, MetricGrid, ProgressBadge, FeatureCard } from '@/components/ui/StatCard';
import { Input, Textarea, Select, Checkbox } from '@/components/ui/Input';
import { Toast, Tooltip, Modal, Dropdown } from '@/components/ui/Feedback';

export default function ComponentShowcase() {
  const [showModal, setShowModal] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#EED9B9] p-12">
      {/* Header */}
      <div className="mb-16 border-b border-[#D53E0F]/30 pb-8">
        <h1 className="text-5xl font-bold text-gradient-apex mb-4">APEX UI Components</h1>
        <p className="text-[#888888] text-lg">New design system with warm colors and smooth animations</p>
      </div>

      {/* Color Palette Reference */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-8">Color Palette</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-6 rounded-lg border border-[#D53E0F]/30 bg-[#1a1a1a]">
            <div className="w-full h-24 bg-[#5E0006] rounded mb-3"></div>
            <p className="font-mono text-sm">#5E0006</p>
            <p className="text-[#888888] text-xs">Deep Crimson</p>
          </div>
          <div className="p-6 rounded-lg border border-[#D53E0F]/30 bg-[#1a1a1a]">
            <div className="w-full h-24 bg-[#9B0F06] rounded mb-3"></div>
            <p className="font-mono text-sm">#9B0F06</p>
            <p className="text-[#888888] text-xs">Dark Red</p>
          </div>
          <div className="p-6 rounded-lg border border-[#D53E0F]/30 bg-[#1a1a1a]">
            <div className="w-full h-24 bg-[#D53E0F] rounded mb-3"></div>
            <p className="font-mono text-sm">#D53E0F</p>
            <p className="text-[#888888] text-xs">Burnt Orange</p>
          </div>
          <div className="p-6 rounded-lg border border-[#D53E0F]/30 bg-[#1a1a1a]">
            <div className="w-full h-24 bg-[#EED9B9] rounded mb-3"></div>
            <p className="font-mono text-sm">#EED9B9</p>
            <p className="text-[#888888] text-xs">Cream</p>
          </div>
        </div>
      </section>

      {/* Buttons */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-8">Buttons & Interactions</h2>
        <div className="flex flex-wrap gap-4 mb-8">
          <Button variant="primary" size="md">Primary Action</Button>
          <Button variant="secondary" size="md">Secondary Action</Button>
          <Button variant="danger" size="md">Danger Zone</Button>
          <Button variant="ghost" size="md">Ghost Button</Button>
          <Button variant="outline" size="md">Outlined</Button>
          <Button isLoading size="md">Loading...</Button>
          <IconButton icon="⚙️" size="md" />
        </div>
      </section>

      {/* Badges & Status */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-8">Badges & Status Indicators</h2>
        <div className="flex flex-wrap gap-4 mb-8">
          <Badge variant="burn" pulse>Active Cycle</Badge>
          <Badge variant="crimson">High Risk</Badge>
          <Badge variant="success">Approved</Badge>
          <Badge variant="danger">Vetoed</Badge>
          <Badge variant="warning">⚠ Pending</Badge>
          <StatusBadge status="active" label="Connected" />
          <StatusBadge status="pending" label="Processing" />
        </div>
      </section>

      {/* Stat Cards */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-8">Metric Cards with Animations</h2>
        <MetricGrid cols={3}>
          <StatCard
            title="Total APY"
            value="24.5"
            unit="%"
            change={+5.2}
            trend="up"
            icon="📈"
            variant="burn"
          />
          <StatCard
            title="Risk Score"
            value="0.32"
            change={-1.8}
            trend="down"
            icon="⚠️"
            variant="default"
          />
          <StatCard
            title="Executed Cycles"
            value="847"
            change={+12.3}
            trend="up"
            icon="✓"
            variant="success"
          />
        </MetricGrid>
      </section>

      {/* Progress Badges */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-8">Progress Indicators</h2>
        <div className="space-y-6">
          <ProgressBadge label="Success Rate" value={85} />
          <ProgressBadge label="Risk Tolerance" value={42} />
          <ProgressBadge label="Capital Deployment" value={68} />
        </div>
      </section>

      {/* Form Elements */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-8">Form Components</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="APY Target"
            placeholder="Enter APY target..."
            icon="🎯"
            variant="burn"
            hint="Minimum APY to consider trading"
          />
          <Input
            label="Risk Tolerance"
            placeholder="0.0 - 1.0"
            type="number"
            variant="default"
          />
          <Select
            label="Protocol"
            options={[
              { value: 'aave', label: 'Aave' },
              { value: 'curve', label: 'Curve Finance' },
              { value: 'compound', label: 'Compound' },
              { value: 'aerodrome', label: 'Aerodrome' },
            ]}
          />
          <Checkbox label="Enable Autonomous Trading" defaultChecked />
          <Textarea
            label="Strategy Notes"
            placeholder="Add strategy notes here..."
            rows={4}
          />
        </div>
      </section>

      {/* Cards */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-8">Card Variations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card variant="bordered" interactive>
            <CardHeader>
              <h3 className="text-lg font-bold">Bordered Card</h3>
            </CardHeader>
            <CardContent>Interactive card with burn border</CardContent>
            <CardFooter>
              <Button size="sm" variant="ghost">Explore</Button>
            </CardFooter>
          </Card>

          <Card variant="glowing" interactive>
            <CardHeader>
              <h3 className="text-lg font-bold">Glowing Card</h3>
            </CardHeader>
            <CardContent>Premium glowing animation effect</CardContent>
            <CardFooter>
              <Button size="sm" variant="primary">Action</Button>
            </CardFooter>
          </Card>

          <Card variant="gradient" interactive>
            <CardHeader>
              <h3 className="text-lg font-bold">Gradient Card</h3>
            </CardHeader>
            <CardContent>Soft gradient background with hover effect</CardContent>
          </Card>

          <Card variant="default" interactive>
            <CardHeader>
              <h3 className="text-lg font-bold">Default Card</h3>
            </CardHeader>
            <CardContent>Minimal, clean card design</CardContent>
          </Card>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-8">Feature Cards</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard
            icon="🤖"
            title="Multi-Agent Pipeline"
            description="Scout, Strategist, Guardian, and Executor work in harmony"
          />
          <FeatureCard
            icon="🔐"
            title="On-Chain Reputation"
            description="ERC-8004 self-certifying yield optimizer with verifiable trust"
          />
          <FeatureCard
            icon="📊"
            title="Real-Time Analytics"
            description="Monitor cycles, APY opportunities, and risk metrics live"
          />
        </div>
      </section>

      {/* Interactive Elements */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-8">Interactive Components</h2>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold mb-4">Tooltip</h3>
            <Tooltip content="This is a helpful tooltip with important information">
              <span className="underline-apex cursor-help">Hover me →</span>
            </Tooltip>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-4">Modal</h3>
            <Button onClick={() => setShowModal(true)} size="md">
              Open Modal
            </Button>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-4">Toast Notifications</h3>
            <Button onClick={() => setToastVisible(true)} size="md">
              Show Toast
            </Button>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-4">Dropdown Menu</h3>
            <Dropdown
              trigger="≡ Menu"
              items={[
                { label: 'View Dashboard', onClick: () => alert('Dashboard') },
                { label: 'Settings', onClick: () => alert('Settings') },
                { label: '', onClick: () => {}, divider: true },
                {
                  label: 'Logout',
                  danger: true,
                  onClick: () => alert('Logged out'),
                },
              ]}
            />
          </div>
        </div>
      </section>

      {/* Modals & Toasts */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Example Modal"
        size="md"
        actions={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setShowModal(false)}>
              Confirm
            </Button>
          </>
        }
      >
        <p className="mb-4">This is a beautiful modal with the new APEX design system.</p>
        <p className="text-[#888888]">Try the new components and animations throughout the app!</p>
      </Modal>

      {toastVisible && (
        <div className="fixed bottom-6 right-6">
          <Toast
            type="success"
            title="Success!"
            message="Component library loaded successfully"
            onClose={() => setToastVisible(false)}
            autoClose
          />
        </div>
      )}
    </div>
  );
}
