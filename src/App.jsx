import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase.js'

// ═══════════════════════════════════════════════════
//  比比拉普 BIBILAPU v3 — Points · Staff · Custom Forms
//  Responsive: Mobile=simple flow, Desktop=3-panel
// ═══════════════════════════════════════════════════

// ─── Theme ───
const T = {
  bg: '#06060A', surface: '#0E0E16', surfaceAlt: '#141420',
  card: '#111119', cardHover: '#18182A',
  border: '#1A1A2E', borderLight: '#22223A',
  accent: '#818CF8', accentDeep: '#6366F1', accentSoft: 'rgba(129,140,248,.1)',
  accentGlow: 'rgba(99,102,241,.2)', accent2: '#C084FC',
  text: '#E8E8F4', textSub: '#8B8DA8', textMuted: '#4E5070',
  success: '#34D399', warn: '#FBBF24', danger: '#F87171',
  gold: '#FBBF24', goldSoft: 'rgba(251,191,36,.12)',
  grad: 'linear-gradient(135deg,#818CF8 0%,#C084FC 50%,#F472B6 100%)',
  gradBtn: 'linear-gradient(135deg,#6366F1 0%,#8B5CF6 100%)',
  gradGold: 'linear-gradient(135deg,#FBBF24 0%,#F59E0B 100%)',
}

const STATUS = {
  pending: { label: '待接單', color: T.warn, icon: '⏳' },
  accepted: { label: '進行中', color: '#60A5FA', icon: '🎮' },
  completed: { label: '已完成', color: T.success, icon: '✅' },
  cancelled: { label: '已取消', color: T.danger, icon: '❌' },
}

// 表單欄位類型
const FIELD_TYPES = [
  { v: 'text', l: '文字輸入' },
  { v: 'textarea', l: '多行文字' },
  { v: 'select', l: '下拉選單' },
  { v: 'radio', l: '單選' },
  { v: 'checkbox', l: '多選' },
]

function useIsDesktop(bp = 860) {
  const [d, setD] = useState(typeof window !== 'undefined' ? window.innerWidth >= bp : true)
  useEffect(() => {
    const h = () => setD(window.innerWidth >= bp)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [bp])
  return d
}

// ─── Build tree from flat catalog ───
function buildTree(items) {
  const map = {}
  const roots = []
  items.sort((a, b) => a.sort_order - b.sort_order)
  items.forEach(i => { map[i.id] = { ...i, children: [] } })
  items.forEach(i => {
    if (i.parent_id && map[i.parent_id]) {
      map[i.parent_id].children.push(map[i.id])
    } else if (!i.parent_id) {
      roots.push(map[i.id])
    }
  })
  return roots
}

// ═══════════ APP ═══════════
export default function App() {
  const [page, setPage] = useState('home')
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [catalog, setCatalog] = useState([])
  const [catalogTree, setCatalogTree] = useState([])
  const [staff, setStaff] = useState([])
  const [orders, setOrders] = useState([])
  const [ann, setAnn] = useState([])
  const [showAuth, setShowAuth] = useState(false)
  const [loading, setLoading] = useState(true)
  const isDesktop = useIsDesktop()

  // ── Init ──
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await loadProfile(session.user.id)
      }
      await loadCatalog()
      await loadStaff()
      await loadAnnouncements()
      setLoading(false)
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user)
        await loadProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadProfile = async (uid) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    if (data) setProfile(data)
  }

  const loadCatalog = async () => {
    const { data } = await supabase.from('catalog').select('*').order('sort_order')
    if (data) {
      setCatalog(data)
      setCatalogTree(buildTree(data))
    }
  }

  const loadStaff = async () => {
    const { data } = await supabase.from('staff').select('*').order('sort_order', { ascending: true })
    if (data) setStaff(data)
  }

  const loadAnnouncements = async () => {
    const { data } = await supabase.from('announcements').select('*').order('published_at', { ascending: false })
    if (data) setAnn(data)
  }

  const loadOrders = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
    if (data) setOrders(data)
  }, [user])

  useEffect(() => { if (user) loadOrders() }, [user, loadOrders])

  // ── Add order (v3 — 支援 staff、form_data、points_cost) ──
  const addOrder = async (o) => {
    const { error } = await supabase.from('orders').insert({
      user_id: user.id,
      catalog_item_id: o.catalogItemId || null,
      game_name: o.game,
      game_icon: o.gameIcon,
      service_path: o.service,
      price: o.price,
      points_cost: o.pointsCost || 0,
      note: o.note,
      staff_id: o.staffId || null,
      staff_name: o.staffName || null,
      form_data: o.formData || {},
      status: 'pending',
    })
    if (!error) {
      await loadOrders()
      setPage('profile')
    } else {
      alert('下單失敗：' + error.message)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setOrders([])
    setPage('home')
  }

  const isAdmin = profile?.role === 'admin'

  if (loading) return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: T.textSub, fontSize: 16 }}>載入中...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: "'Noto Sans TC','Sora',sans-serif" }}>
      <style>{`
        input:focus,textarea:focus,select:focus{border-color:${T.accent}!important;outline:none;box-shadow:0 0 0 3px ${T.accentSoft}}
        button{font-family:'Noto Sans TC','Sora',sans-serif;cursor:pointer}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .fu{animation:fadeUp .45s ease both}.fi{animation:fadeIn .4s ease both}
        .hlift{transition:transform .2s,box-shadow .2s,border-color .2s}
        .hlift:hover{transform:translateY(-3px);box-shadow:0 12px 32px rgba(0,0,0,.4);border-color:${T.borderLight}!important}
        .game-card{position:relative;overflow:hidden}
        .game-card::after{content:'';position:absolute;inset:0;opacity:0;transition:opacity .3s;background:radial-gradient(circle at var(--mx,50%) var(--my,50%),rgba(255,255,255,.06),transparent 60%);pointer-events:none}
        .game-card:hover::after{opacity:1}
        ::-webkit-scrollbar{width:8px;height:8px}
        ::-webkit-scrollbar-track{background:${T.bg}}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:4px}
        ::-webkit-scrollbar-thumb:hover{background:${T.borderLight}}
      `}</style>

      {/* NAV */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(6,6,10,.8)', backdropFilter: 'blur(28px) saturate(1.5)',
        borderBottom: `1px solid ${T.border}`,
        padding: '0 20px', height: isDesktop ? 60 : 52,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isDesktop ? 28 : 12 }}>
          <span onClick={() => setPage('home')} style={{
            cursor: 'pointer', fontFamily: 'Sora', fontWeight: 800, fontSize: isDesktop ? 20 : 15,
            background: T.grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>比比拉普</span>
          <div style={{ display: 'flex', gap: 2 }}>
            {[
              { k: 'home', l: '首頁' }, { k: 'order', l: '下單' }, { k: 'profile', l: '我的' },
              ...(isAdmin ? [{ k: 'admin', l: '後台' }] : []),
            ].map(n => (
              <button key={n.k} onClick={() => {
                if ((n.k === 'profile' || n.k === 'admin') && !user) { setShowAuth(true); return }
                if (n.k === 'profile' || n.k === 'admin') loadOrders()
                setPage(n.k)
              }} style={{
                background: page === n.k ? T.accentSoft : 'transparent',
                color: page === n.k ? T.accent : T.textSub,
                border: 'none', padding: isDesktop ? '7px 16px' : '5px 10px',
                borderRadius: 8, fontSize: isDesktop ? 14 : 12, fontWeight: 500,
              }}>{n.l}</button>
            ))}
          </div>
        </div>
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: isDesktop ? 12 : 8 }}>
            {/* 點數餘額 */}
            <div onClick={() => setPage('profile')} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: isDesktop ? '5px 12px' : '4px 9px',
              background: T.goldSoft, color: T.gold,
              border: `1px solid rgba(251,191,36,.2)`,
              borderRadius: 20, fontSize: isDesktop ? 13 : 11, fontWeight: 700,
              fontFamily: 'Sora', cursor: 'pointer',
            }}>
              <span style={{ fontSize: isDesktop ? 14 : 12 }}>💎</span>
              {(profile?.points || 0).toLocaleString('zh-TW')}
            </div>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0 }} />
            ) : (
              <div style={{
                width: 30, height: 30, borderRadius: '50%', background: T.gradBtn,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'Sora',
              }}>{(profile?.name || user.email)[0]}</div>
            )}
            {isDesktop && <span style={{ fontSize: 13, fontWeight: 500 }}>{profile?.name || user.email}</span>}
            <button onClick={handleLogout} style={{
              background: 'rgba(248,113,113,.06)', color: T.danger,
              border: `1px solid rgba(248,113,113,.12)`, padding: '4px 10px',
              borderRadius: 6, fontSize: 11,
            }}>登出</button>
          </div>
        ) : (
          <button onClick={() => setShowAuth(true)} style={{
            background: T.gradBtn, color: '#fff', border: 'none',
            padding: '7px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          }}>登入</button>
        )}
      </nav>

      {showAuth && <AuthModal close={() => setShowAuth(false)} />}

      <div style={{ maxWidth: page === 'order' && isDesktop ? 1280 : 1060, margin: '0 auto', padding: isDesktop ? '32px 24px 80px' : '24px 14px 80px' }}>
        {page === 'home' && <HomePage ann={ann} catalog={catalogTree} staff={staff} go={setPage} isDesktop={isDesktop} />}
        {page === 'order' && (
          isDesktop
            ? <DesktopOrder catalog={catalogTree} staff={staff} user={user} profile={profile} addOrder={addOrder} auth={() => setShowAuth(true)} />
            : <MobileOrder catalog={catalogTree} staff={staff} user={user} profile={profile} addOrder={addOrder} auth={() => setShowAuth(true)} />
        )}
        {page === 'profile' && user && <ProfilePage profile={profile} orders={orders} staff={staff} isDesktop={isDesktop} loadOrders={loadOrders} reloadProfile={() => loadProfile(user.id)} />}
        {page === 'admin' && isAdmin && <AdminPage catalog={catalog} catalogTree={catalogTree} reload={loadCatalog} orders={orders} loadOrders={loadOrders} staff={staff} reloadStaff={loadStaff} ann={ann} reloadAnnouncements={loadAnnouncements} />}
      </div>
    </div>
  )
}

// ═══════════ AUTH ═══════════
function AuthModal({ close }) {
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const loginWithDiscord = async () => {
    setBusy(true)
    setErr('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: window.location.origin },
    })
    if (error) { setErr(error.message); setBusy(false) }
  }

  return (
    <div onClick={close} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} className="fu" style={{
        background: T.surface, borderRadius: 18, padding: 32, width: '100%', maxWidth: 380,
        border: `1px solid ${T.border}`, textAlign: 'center',
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎮</div>
        <h2 style={{ fontFamily: 'Sora', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>登入比比拉普</h2>
        <p style={{ color: T.textSub, fontSize: 13, marginBottom: 24 }}>使用 Discord 帳號快速登入</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {err && <div style={{ color: T.danger, fontSize: 12 }}>{err}</div>}
          <button onClick={loginWithDiscord} disabled={busy} style={{
            background: '#5865F2', color: '#fff', border: 'none',
            padding: '13px 20px', borderRadius: 12, fontSize: 15, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            opacity: busy ? .6 : 1, transition: 'opacity .2s',
            boxShadow: '0 4px 16px rgba(88,101,242,.3)',
          }}>
            <DiscordIcon w={20} h={15} />
            {busy ? '連線中...' : '使用 Discord 登入'}
          </button>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
            登入後可在個人頁面綁定 Gmail
          </div>
        </div>
      </div>
    </div>
  )
}

function DiscordIcon({ w = 20, h = 15, fill = 'white' }) {
  return (
    <svg width={w} height={h} viewBox="0 0 71 55" fill="none">
      <path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.4 37.4 0 0025.4.3a.2.2 0 00-.2-.1A58.4 58.4 0 0010.5 4.9a.2.2 0 00-.1.1C1.5 18.7-.9 32.2.3 45.5v.1a58.7 58.7 0 0017.7 9a.2.2 0 00.3-.1 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.7 38.7 0 01-5.5-2.6.2.2 0 010-.4c.4-.3.7-.6 1.1-.8a.2.2 0 01.2 0c11.5 5.3 24 5.3 35.4 0a.2.2 0 01.3 0l1 .9a.2.2 0 010 .3 36.3 36.3 0 01-5.5 2.6.2.2 0 00-.1.4 47.2 47.2 0 003.6 5.8.2.2 0 00.3.1 58.5 58.5 0 0017.7-9v-.1c1.4-15-2.3-28.4-9.8-40.1a.2.2 0 00-.1-.1zM23.7 37.3c-3.5 0-6.3-3.2-6.3-7s2.8-7 6.3-7 6.4 3.2 6.3 7-2.8 7-6.3 7zm23.2 0c-3.5 0-6.3-3.2-6.3-7s2.8-7 6.3-7 6.4 3.2 6.3 7-2.8 7-6.3 7z" fill={fill}/>
    </svg>
  )
}

// ═══════════ HOME ═══════════
function HomePage({ ann, catalog, staff, go, isDesktop }) {
  const activeStaff = staff.filter(s => s.active !== false)
  return (
    <div>
      <div style={{ textAlign: 'center', padding: isDesktop ? '72px 20px 56px' : '48px 16px 40px', position: 'relative' }}>
        <div style={{
          position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)',
          width: isDesktop ? 500 : 300, height: isDesktop ? 500 : 300, borderRadius: '50%',
          background: 'radial-gradient(circle,rgba(99,102,241,.08) 0%,transparent 70%)',
          filter: 'blur(60px)', pointerEvents: 'none',
        }} />
        <h1 className="fu" style={{
          fontFamily: 'Sora', fontSize: isDesktop ? 52 : 34, fontWeight: 800,
          letterSpacing: '-1.5px', lineHeight: 1, position: 'relative', marginBottom: 16,
        }}>
          <span style={{ background: T.grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>比比拉普</span>
        </h1>
        <p className="fu" style={{ color: T.textSub, fontSize: isDesktop ? 17 : 14, marginBottom: 32, position: 'relative', animationDelay: '.1s' }}>
          專業遊戲代練工作室 — 安全・迅速・保密
        </p>
        <button className="fu hlift" onClick={() => go('order')} style={{
          background: T.gradBtn, color: '#fff', border: 'none',
          padding: isDesktop ? '14px 40px' : '12px 32px', borderRadius: 14,
          fontSize: isDesktop ? 16 : 14, fontWeight: 600, position: 'relative',
          boxShadow: `0 4px 24px ${T.accentGlow}`, animationDelay: '.2s',
        }}>立即下單 →</button>
      </div>

      <Sec title="📢 最新公告">
        {ann.length === 0 ? (
          <div style={{ background: T.surface, borderRadius: 12, padding: '20px 24px', border: `1px solid ${T.border}`, color: T.textMuted, fontSize: 13, textAlign: 'center' }}>
            目前沒有公告
          </div>
        ) : ann.map(a => (
          <div key={a.id} style={{
            background: T.surface, borderRadius: 12, padding: isDesktop ? '20px 24px' : '16px 18px',
            border: `1px solid ${T.border}`, marginBottom: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{a.title}</span>
              <span style={{ color: T.textMuted, fontSize: 11 }}>{new Date(a.published_at).toLocaleDateString('zh-TW')}</span>
            </div>
            {a.body && <p style={{ color: T.textSub, fontSize: 13, lineHeight: 1.6 }}>{a.body}</p>}
            {a.link_url && (
              <a href={a.link_url} target="_blank" rel="noopener noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                marginTop: 10, padding: '6px 14px',
                background: T.accentSoft, color: T.accent,
                border: `1px solid rgba(129,140,248,.25)`, borderRadius: 8,
                fontSize: 12, fontWeight: 600, textDecoration: 'none',
              }}>
                {a.link_label || '查看詳情'}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
              </a>
            )}
          </div>
        ))}
      </Sec>

      <Sec title="🎮 支援遊戲">
        <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? `repeat(${Math.min(Math.max(catalog.length, 1), 5)},1fr)` : 'repeat(auto-fill,minmax(140px,1fr))', gap: isDesktop ? 14 : 10 }}>
          {catalog.map(g => (
            <div key={g.id} onClick={() => go('order')} className="hlift fu game-card"
              onMouseMove={e => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--mx', ((e.clientX-r.left)/r.width*100)+'%'); e.currentTarget.style.setProperty('--my', ((e.clientY-r.top)/r.height*100)+'%') }}
              style={{
                background: T.surface, borderRadius: 14,
                padding: isDesktop ? '32px 16px' : '22px 12px',
                border: `1px solid ${T.border}`, cursor: 'pointer', textAlign: 'center',
              }}>
              {g.image_url ? (
                <img src={g.image_url} alt="" style={{ width: isDesktop ? 60 : 44, height: isDesktop ? 60 : 44, borderRadius: 10, objectFit: 'cover', marginBottom: 10 }} />
              ) : (
                <div style={{ fontSize: isDesktop ? 40 : 30, marginBottom: 10 }}>{g.icon || '🎮'}</div>
              )}
              <div style={{ fontSize: isDesktop ? 15 : 13, fontWeight: 700 }}>{g.name}</div>
              <div style={{ width: 24, height: 3, borderRadius: 2, margin: '10px auto 0', background: g.color || T.accent, opacity: .7 }} />
            </div>
          ))}
        </div>
      </Sec>

      <Sec title="👾 團隊成員">
        {activeStaff.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 14, background: T.accentSoft, borderRadius: 10, border: `1px dashed rgba(129,140,248,.2)`, fontSize: 12, color: T.textSub }}>
            🔗 員工資料尚未建立
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(auto-fill,minmax(180px,1fr))' : 'repeat(auto-fill,minmax(140px,1fr))', gap: 12 }}>
            {activeStaff.map(s => (
              <StaffCard key={s.id} s={s} compact />
            ))}
          </div>
        )}
      </Sec>
    </div>
  )
}

function Sec({ title, children }) {
  return <div style={{ marginBottom: 36 }}><h2 style={{ fontFamily: 'Sora', fontSize: 18, fontWeight: 700, marginBottom: 14 }}>{title}</h2>{children}</div>
}

// ═══════════ STAFF CARD ═══════════
function StaffCard({ s, compact, selected, onClick }) {
  const tags = Array.isArray(s.tags) ? s.tags : (typeof s.tags === 'string' && s.tags ? s.tags.split(',').map(x => x.trim()).filter(Boolean) : [])
  const games = Array.isArray(s.games) ? s.games : (typeof s.games === 'string' && s.games ? s.games.split(',').map(x => x.trim()).filter(Boolean) : [])
  const available = s.available !== false
  return (
    <div onClick={onClick} className={onClick ? 'hlift' : ''} style={{
      background: selected ? T.accentSoft : T.surface,
      borderRadius: 12, padding: compact ? 14 : 16,
      border: `1px solid ${selected ? T.accent : T.border}`,
      cursor: onClick ? 'pointer' : 'default',
      textAlign: 'center', position: 'relative',
      opacity: available ? 1 : .55,
    }}>
      {!available && (
        <div style={{ position: 'absolute', top: 8, right: 8, background: T.surfaceAlt, color: T.textMuted, padding: '2px 8px', borderRadius: 10, fontSize: 9, fontWeight: 600 }}>暫停接單</div>
      )}
      {s.avatar_url ? (
        <img src={s.avatar_url} alt="" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 8px', display: 'block' }} />
      ) : (
        <div style={{ width: 52, height: 52, borderRadius: '50%', margin: '0 auto 8px', background: T.gradBtn, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff', fontFamily: 'Sora' }}>
          {(s.name || '?')[0]}
        </div>
      )}
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{s.name}</div>
      {games.length > 0 && (
        <div style={{ fontSize: 10, color: T.textSub, marginBottom: 6 }}>
          {games.slice(0, 3).join(' · ')}
        </div>
      )}
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', marginTop: 4 }}>
          {tags.slice(0, 3).map((t, i) => (
            <span key={i} style={{ background: T.accentSoft, color: T.accent, padding: '2px 7px', borderRadius: 8, fontSize: 9, fontWeight: 600 }}>{t}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════ 自訂表單元件 ═══════════
function DynamicFormFields({ fields, values, onChange }) {
  if (!fields || fields.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {fields.map((f, idx) => {
        const key = f.key || `field_${idx}`
        const v = values[key] ?? (f.type === 'checkbox' ? [] : '')
        const setV = (nv) => onChange({ ...values, [key]: nv })
        const labelEl = (
          <div style={{ fontSize: 12, color: T.textSub, marginBottom: 5 }}>
            {f.label}{f.required && <span style={{ color: T.danger, marginLeft: 3 }}>*</span>}
          </div>
        )
        const inputBase = {
          background: 'rgba(255,255,255,.03)', border: `1px solid ${T.border}`,
          borderRadius: 8, padding: '8px 12px', color: T.text, fontSize: 13, width: '100%',
        }
        if (f.type === 'textarea') {
          return (
            <div key={key}>
              {labelEl}
              <textarea value={v} onChange={e => setV(e.target.value)} placeholder={f.placeholder || ''}
                style={{ ...inputBase, minHeight: 70, resize: 'vertical' }} />
            </div>
          )
        }
        if (f.type === 'select') {
          const opts = Array.isArray(f.options) ? f.options : (typeof f.options === 'string' ? f.options.split(',').map(x => x.trim()).filter(Boolean) : [])
          return (
            <div key={key}>
              {labelEl}
              <select value={v} onChange={e => setV(e.target.value)} style={inputBase}>
                <option value="">請選擇...</option>
                {opts.map((o, i) => <option key={i} value={o}>{o}</option>)}
              </select>
            </div>
          )
        }
        if (f.type === 'radio') {
          const opts = Array.isArray(f.options) ? f.options : (typeof f.options === 'string' ? f.options.split(',').map(x => x.trim()).filter(Boolean) : [])
          return (
            <div key={key}>
              {labelEl}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {opts.map((o, i) => (
                  <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '6px 10px', background: v === o ? T.accentSoft : T.surfaceAlt, borderRadius: 8, border: `1px solid ${v === o ? T.accent : T.border}` }}>
                    <input type="radio" checked={v === o} onChange={() => setV(o)} style={{ accentColor: T.accent }} />
                    {o}
                  </label>
                ))}
              </div>
            </div>
          )
        }
        if (f.type === 'checkbox') {
          const opts = Array.isArray(f.options) ? f.options : (typeof f.options === 'string' ? f.options.split(',').map(x => x.trim()).filter(Boolean) : [])
          const arr = Array.isArray(v) ? v : []
          const toggle = (o) => arr.includes(o) ? setV(arr.filter(x => x !== o)) : setV([...arr, o])
          return (
            <div key={key}>
              {labelEl}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {opts.map((o, i) => {
                  const on = arr.includes(o)
                  return (
                    <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', padding: '6px 10px', background: on ? T.accentSoft : T.surfaceAlt, borderRadius: 8, border: `1px solid ${on ? T.accent : T.border}` }}>
                      <input type="checkbox" checked={on} onChange={() => toggle(o)} style={{ accentColor: T.accent }} />
                      {o}
                    </label>
                  )
                })}
              </div>
            </div>
          )
        }
        // text
        return (
          <div key={key}>
            {labelEl}
            <input value={v} onChange={e => setV(e.target.value)} placeholder={f.placeholder || ''} style={inputBase} />
          </div>
        )
      })}
    </div>
  )
}

function validateForm(fields, values) {
  if (!fields || fields.length === 0) return null
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i]
    if (!f.required) continue
    const key = f.key || `field_${i}`
    const v = values[key]
    if (f.type === 'checkbox') {
      if (!Array.isArray(v) || v.length === 0) return `請填寫「${f.label}」`
    } else if (!v || (typeof v === 'string' && !v.trim())) {
      return `請填寫「${f.label}」`
    }
  }
  return null
}

// ═══════════ DESKTOP ORDER ═══════════
function DesktopOrder({ catalog, staff, user, profile, addOrder, auth }) {
  const [selGame, setSelGame] = useState(0)
  const [path, setPath] = useState([])
  const [note, setNote] = useState('')
  const [selStaff, setSelStaff] = useState(null)
  const [formData, setFormData] = useState({})
  const [hoverIdx, setHoverIdx] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const game = catalog[selGame]
  let currentItems = game?.children || []
  const breadcrumb = game ? [game] : []
  for (let i = 0; i < path.length; i++) {
    const node = currentItems[path[i]]
    if (!node) break
    breadcrumb.push(node)
    currentItems = node?.children || []
  }
  const currentNode = breadcrumb[breadcrumb.length - 1]
  const isLeaf = path.length > 0 && (!currentNode?.children?.length) && (currentNode?.price || currentNode?.points_cost)

  // 重置表單當切換品項
  useEffect(() => { setFormData({}); setSelStaff(null) }, [currentNode?.id])

  const customFields = Array.isArray(currentNode?.form_fields) ? currentNode.form_fields : []
  const pointsCost = currentNode?.points_cost ?? (currentNode?.price ? parseInt(String(currentNode.price).replace(/[^\d]/g, '')) || 0 : 0)
  const userPoints = profile?.points || 0
  const enoughPoints = userPoints >= pointsCost

  // 過濾這個遊戲可服務的員工
  const availStaff = staff.filter(s => {
    if (s.active === false) return false
    if (!game?.name) return true
    const games = Array.isArray(s.games) ? s.games : (typeof s.games === 'string' && s.games ? s.games.split(',').map(x => x.trim()) : [])
    if (games.length === 0) return true
    return games.some(g => g.includes(game.name) || game.name.includes(g))
  })

  const handleOrder = async () => {
    if (!user) { auth(); return }
    if (!enoughPoints) { alert(`點數不足！需要 ${pointsCost.toLocaleString()} 點，目前只有 ${userPoints.toLocaleString()} 點`); return }
    const err = validateForm(customFields, formData)
    if (err) { alert(err); return }
    setSubmitting(true)
    await addOrder({
      catalogItemId: currentNode?.id,
      game: game.name,
      gameIcon: game.icon || '🎮',
      service: breadcrumb.slice(1).map(b => b.name).join(' › '),
      price: currentNode?.price || `${pointsCost} 點`,
      pointsCost,
      note,
      staffId: selStaff?.id || null,
      staffName: selStaff?.name || null,
      formData,
    })
    setPath([]); setNote(''); setFormData({}); setSelStaff(null); setSubmitting(false)
  }

  return (
    <div className="fu" style={{ display: 'grid', gridTemplateColumns: '220px 1fr 340px', gap: 16, minHeight: 'calc(100vh - 140px)' }}>
      {/* LEFT: GAMES */}
      <div style={{ background: T.surface, borderRadius: 16, border: `1px solid ${T.border}`, padding: '20px 12px', alignSelf: 'start', position: 'sticky', top: 76 }}>
        <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, letterSpacing: '1.5px', marginBottom: 14, paddingLeft: 8 }}>選擇遊戲</div>
        {catalog.map((g, i) => (
          <div key={g.id} onClick={() => { setSelGame(i); setPath([]) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px', borderRadius: 10, cursor: 'pointer', marginBottom: 4,
              background: selGame === i ? T.accentSoft : 'transparent',
              border: `1px solid ${selGame === i ? (g.color || T.accent) + '30' : 'transparent'}`,
              transition: 'all .2s', position: 'relative',
            }}>
            {g.image_url ? (
              <img src={g.image_url} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 22 }}>{g.icon || '🎮'}</span>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: selGame === i ? 700 : 500, color: selGame === i ? T.text : T.textSub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</div>
              <div style={{ fontSize: 10, color: T.textMuted }}>{g.children?.length || 0} 個分類</div>
            </div>
            {selGame === i && <div style={{ position: 'absolute', left: 0, top: '20%', height: '60%', width: 3, borderRadius: '0 2px 2px 0', background: g.color || T.accent }} />}
          </div>
        ))}
      </div>

      {/* CENTER: BREADCRUMB + ITEMS or LEAF DETAIL */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, padding: '14px 18px', background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 20 }}>{game?.icon}</span>
          {breadcrumb.map((b, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {i > 0 && <span style={{ color: T.textMuted, fontSize: 14 }}>›</span>}
              <span onClick={() => { if (i === 0) setPath([]); else setPath(path.slice(0, i)) }}
                style={{ color: i === breadcrumb.length - 1 ? T.text : T.accent, cursor: i === breadcrumb.length - 1 ? 'default' : 'pointer', fontSize: 14, fontWeight: i === breadcrumb.length - 1 ? 700 : 500 }}>
                {b?.name}
              </span>
            </span>
          ))}
        </div>

        {isLeaf ? (
          <div className="fi" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 品項詳情 */}
            <div style={{ background: T.surface, borderRadius: 16, border: `1px solid ${T.border}`, padding: 28, textAlign: 'center' }}>
              {currentNode.image_url ? (
                <img src={currentNode.image_url} alt="" style={{ width: 80, height: 80, borderRadius: 12, objectFit: 'cover', margin: '0 auto 16px', display: 'block' }} />
              ) : (
                <div style={{ fontSize: 48, marginBottom: 16 }}>{game?.icon}</div>
              )}
              <h3 style={{ fontFamily: 'Sora', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{currentNode.name}</h3>
              {currentNode.description && <p style={{ color: T.textSub, fontSize: 14, marginBottom: 16 }}>{currentNode.description}</p>}
              <div style={{ display: 'inline-block', background: T.goldSoft, color: T.gold, padding: '8px 24px', borderRadius: 20, fontWeight: 700, fontSize: 18, border: `1px solid rgba(251,191,36,.2)`, fontFamily: 'Sora' }}>💎 {pointsCost.toLocaleString('zh-TW')} 點</div>
            </div>

            {/* 員工選擇 */}
            <div style={{ background: T.surface, borderRadius: 16, border: `1px solid ${T.border}`, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h4 style={{ fontFamily: 'Sora', fontSize: 15, fontWeight: 700 }}>👥 指定員工 <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 500 }}>（選填）</span></h4>
                {selStaff && (
                  <button onClick={() => setSelStaff(null)} style={{ background: 'transparent', color: T.textSub, border: `1px solid ${T.border}`, padding: '4px 10px', borderRadius: 6, fontSize: 11 }}>清除選擇</button>
                )}
              </div>
              {availStaff.length === 0 ? (
                <div style={{ color: T.textMuted, fontSize: 13, textAlign: 'center', padding: 20 }}>目前沒有可服務此遊戲的員工</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
                  {availStaff.map(s => (
                    <StaffCard key={s.id} s={s} compact selected={selStaff?.id === s.id}
                      onClick={() => s.available !== false && setSelStaff(selStaff?.id === s.id ? null : s)} />
                  ))}
                </div>
              )}
            </div>

            {/* 自訂表單 */}
            {customFields.length > 0 && (
              <div style={{ background: T.surface, borderRadius: 16, border: `1px solid ${T.border}`, padding: 24 }}>
                <h4 style={{ fontFamily: 'Sora', fontSize: 15, fontWeight: 700, marginBottom: 14 }}>📝 委託資訊</h4>
                <DynamicFormFields fields={customFields} values={formData} onChange={setFormData} />
              </div>
            )}

            <button onClick={() => setPath(path.slice(0, -1))} style={{ background: 'transparent', color: T.textSub, border: 'none', fontSize: 13, padding: 8 }}>← 返回上一層</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: (currentItems.length <= 2 ? '1fr 1fr' : 'repeat(auto-fill,minmax(220px,1fr))'), gap: 12 }}>
            {currentItems.length === 0 ? (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', color: T.textMuted, padding: 40, background: T.surface, borderRadius: 12, border: `1px solid ${T.border}` }}>
                此遊戲尚未建立服務項目
              </div>
            ) : currentItems.map((item, idx) => {
              const hasKids = item.children?.length > 0
              const isH = hoverIdx === idx
              const itemPoints = item.points_cost ?? (item.price ? parseInt(String(item.price).replace(/[^\d]/g, '')) || 0 : 0)
              return (
                <div key={item.id} className="hlift fu game-card"
                  onMouseEnter={() => setHoverIdx(idx)} onMouseLeave={() => setHoverIdx(null)}
                  onMouseMove={e => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--mx', ((e.clientX-r.left)/r.width*100)+'%'); e.currentTarget.style.setProperty('--my', ((e.clientY-r.top)/r.height*100)+'%') }}
                  onClick={() => setPath([...path, idx])}
                  style={{
                    background: T.card, borderRadius: 14, padding: 24,
                    border: `1px solid ${isH ? T.borderLight : T.border}`,
                    cursor: 'pointer', position: 'relative', overflow: 'hidden',
                    animationDelay: `${idx * .05}s`,
                  }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: game?.color || T.accent, opacity: isH ? .8 : .2, transition: 'opacity .3s' }} />
                  {item.image_url && (
                    <img src={item.image_url} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', marginBottom: 8 }} />
                  )}
                  <div style={{ fontSize: 13, color: T.textMuted, fontWeight: 500, marginBottom: 6 }}>{hasKids ? `${item.children.length} 項服務` : '服務項目'}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, fontFamily: 'Sora' }}>{item.name}</div>
                  {item.description && <div style={{ fontSize: 12, color: T.textSub, marginBottom: 10, lineHeight: 1.5 }}>{item.description}</div>}
                  {!hasKids && itemPoints > 0 && <div style={{ display: 'inline-block', background: T.goldSoft, color: T.gold, padding: '4px 14px', borderRadius: 16, fontSize: 12, fontWeight: 700, border: `1px solid rgba(251,191,36,.2)`, fontFamily: 'Sora' }}>💎 {itemPoints.toLocaleString('zh-TW')} 點</div>}
                  <div style={{ position: 'absolute', bottom: 16, right: 16, color: isH ? T.accent : T.textMuted, fontSize: 18, transition: 'all .2s', transform: isH ? 'translateX(3px)' : 'none' }}>{hasKids ? '›' : '→'}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* RIGHT: ORDER PREVIEW */}
      <div style={{ background: T.surface, borderRadius: 16, border: `1px solid ${T.border}`, padding: 24, alignSelf: 'start', position: 'sticky', top: 76, maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}>
        <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, letterSpacing: '1.5px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: isLeaf ? T.success : T.textMuted, boxShadow: isLeaf ? `0 0 8px ${T.success}` : 'none' }} />
          訂單預覽
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: T.surfaceAlt, borderRadius: 10, marginBottom: 12, border: `1px solid ${(game?.color || T.accent) + '20'}` }}>
          <span style={{ fontSize: 24 }}>{game?.icon}</span>
          <div><div style={{ fontSize: 14, fontWeight: 700 }}>{game?.name}</div><div style={{ fontSize: 11, color: T.textSub }}>已選擇遊戲</div></div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>服務路徑</div>
          {breadcrumb.length <= 1 ? (
            <div style={{ fontSize: 13, color: T.textMuted, fontStyle: 'italic', padding: '8px 0' }}>尚未選擇服務...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {breadcrumb.slice(1).map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: T.surfaceAlt, borderRadius: 6, fontSize: 13, fontWeight: 500, borderLeft: `2px solid ${game?.color || T.accent}`, marginLeft: i * 12 }}>
                  <span style={{ color: T.textMuted, fontSize: 10 }}>L{i + 1}</span>{b.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {selStaff && (
          <div style={{ marginBottom: 16, padding: 12, background: T.surfaceAlt, borderRadius: 10, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            {selStaff.avatar_url ? (
              <img src={selStaff.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: T.gradBtn, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>{selStaff.name[0]}</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: T.textMuted }}>指定員工</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{selStaff.name}</div>
            </div>
          </div>
        )}

        {isLeaf && pointsCost > 0 && (
          <div className="fi" style={{ textAlign: 'center', padding: 16, marginBottom: 16, background: `linear-gradient(135deg,${T.goldSoft},rgba(245,158,11,.06))`, borderRadius: 12, border: `1px solid rgba(251,191,36,.2)` }}>
            <div style={{ fontSize: 11, color: T.textSub, marginBottom: 4 }}>本次扣款</div>
            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Sora', color: T.gold }}>💎 {pointsCost.toLocaleString('zh-TW')}</div>
            <div style={{ fontSize: 11, color: T.textSub, marginTop: 6, paddingTop: 8, borderTop: `1px dashed ${T.border}` }}>
              目前餘額 <span style={{ color: enoughPoints ? T.text : T.danger, fontWeight: 600 }}>{userPoints.toLocaleString('zh-TW')} 點</span>
              {!enoughPoints && <div style={{ color: T.danger, fontSize: 10, marginTop: 3 }}>點數不足</div>}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 6 }}>備註說明</div>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="想補充的內容..."
            style={{ background: 'rgba(255,255,255,.03)', border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', color: T.text, fontSize: 13, width: '100%', minHeight: 70, resize: 'vertical' }} />
        </div>
        <button onClick={handleOrder} disabled={!isLeaf || submitting || (user && !enoughPoints)}
          style={{
            background: (isLeaf && enoughPoints && !submitting) ? T.gradBtn : T.surfaceAlt,
            color: (isLeaf && enoughPoints && !submitting) ? '#fff' : T.textMuted,
            border: 'none', padding: '13px', borderRadius: 12, width: '100%', fontSize: 14, fontWeight: 600,
            boxShadow: (isLeaf && enoughPoints) ? `0 4px 20px ${T.accentGlow}` : 'none',
            opacity: (isLeaf && enoughPoints) ? 1 : .5,
          }}>
          {!user ? '請先登入' : !isLeaf ? '請選擇服務項目' : !enoughPoints ? '點數不足' : submitting ? '送出中...' : '確認下單 ✓'}
        </button>
      </div>
    </div>
  )
}

// ═══════════ MOBILE ORDER ═══════════
function MobileOrder({ catalog, staff, user, profile, addOrder, auth }) {
  const [path, setPath] = useState([])
  const [note, setNote] = useState('')
  const [selStaff, setSelStaff] = useState(null)
  const [formData, setFormData] = useState({})
  const [submitting, setSubmitting] = useState(false)

  let currentItems = catalog
  const breadcrumb = []
  for (let i = 0; i < path.length; i++) {
    const node = currentItems[path[i]]
    if (!node) break
    breadcrumb.push(node)
    currentItems = node?.children || []
  }
  const currentNode = breadcrumb[breadcrumb.length - 1]
  const isLeaf = breadcrumb.length > 0 && (!currentNode?.children?.length) && (currentNode?.price || currentNode?.points_cost)
  const game = breadcrumb[0]

  useEffect(() => { setFormData({}); setSelStaff(null) }, [currentNode?.id])

  const customFields = Array.isArray(currentNode?.form_fields) ? currentNode.form_fields : []
  const pointsCost = currentNode?.points_cost ?? (currentNode?.price ? parseInt(String(currentNode.price).replace(/[^\d]/g, '')) || 0 : 0)
  const userPoints = profile?.points || 0
  const enoughPoints = userPoints >= pointsCost

  const availStaff = staff.filter(s => {
    if (s.active === false) return false
    if (!game?.name) return true
    const games = Array.isArray(s.games) ? s.games : (typeof s.games === 'string' && s.games ? s.games.split(',').map(x => x.trim()) : [])
    if (games.length === 0) return true
    return games.some(g => g.includes(game.name) || game.name.includes(g))
  })

  const handleOrder = async () => {
    if (!user) { auth(); return }
    if (!enoughPoints) { alert(`點數不足！需要 ${pointsCost.toLocaleString()} 點`); return }
    const err = validateForm(customFields, formData)
    if (err) { alert(err); return }
    setSubmitting(true)
    await addOrder({
      catalogItemId: currentNode?.id,
      game: game?.name || '',
      gameIcon: game?.icon || '🎮',
      service: breadcrumb.slice(1).map(b => b.name).join(' › '),
      price: currentNode?.price || `${pointsCost} 點`,
      pointsCost,
      note,
      staffId: selStaff?.id || null,
      staffName: selStaff?.name || null,
      formData,
    })
    setPath([]); setNote(''); setFormData({}); setSelStaff(null); setSubmitting(false)
  }

  return (
    <div>
      <h1 className="fu" style={{ fontFamily: 'Sora', fontSize: 24, fontWeight: 800, textAlign: 'center', marginBottom: 4 }}>下單委託</h1>
      <p className="fu" style={{ textAlign: 'center', color: T.textSub, fontSize: 13, marginBottom: 20 }}>
        {path.length === 0 ? '選擇遊戲' : isLeaf ? '確認訂單' : '選擇項目'}
      </p>

      {user && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16, padding: '6px 14px', background: T.goldSoft, borderRadius: 16, border: `1px solid rgba(251,191,36,.2)`, width: 'fit-content', margin: '0 auto 16px' }}>
          <span>💎</span>
          <span style={{ fontSize: 12, color: T.gold, fontWeight: 700, fontFamily: 'Sora' }}>{userPoints.toLocaleString('zh-TW')} 點</span>
        </div>
      )}

      {path.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <span onClick={() => setPath([])} style={{ color: T.accent, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>全部</span>
          {breadcrumb.map((b, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: T.textMuted, fontSize: 10 }}>›</span>
              <span onClick={() => setPath(path.slice(0, i + 1))} style={{ color: i === breadcrumb.length - 1 ? T.text : T.accent, cursor: i === breadcrumb.length - 1 ? 'default' : 'pointer', fontSize: 12, fontWeight: i === breadcrumb.length - 1 ? 600 : 500 }}>
                {i === 0 && b.icon ? b.icon + ' ' : ''}{b.name}
              </span>
            </span>
          ))}
        </div>
      )}

      {isLeaf ? (
        <div className="fu" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: T.surface, borderRadius: 14, padding: 18, border: `1px solid ${T.border}` }}>
            <h3 style={{ fontFamily: 'Sora', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>確認訂單</h3>
            <InfoRow label="遊戲" val={`${game?.icon || ''} ${game?.name}`} />
            <InfoRow label="服務" val={breadcrumb.slice(1).map(b => b.name).join(' › ')} />
            <InfoRow label="點數" val={`💎 ${pointsCost.toLocaleString('zh-TW')} 點`} hl />
            {currentNode.description && <InfoRow label="說明" val={currentNode.description} />}
          </div>

          {/* 員工選擇 */}
          {availStaff.length > 0 && (
            <div style={{ background: T.surface, borderRadius: 14, padding: 16, border: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <h4 style={{ fontFamily: 'Sora', fontSize: 13, fontWeight: 700 }}>👥 指定員工 <span style={{ fontSize: 10, color: T.textMuted, fontWeight: 500 }}>選填</span></h4>
                {selStaff && <button onClick={() => setSelStaff(null)} style={{ background: 'transparent', color: T.textSub, border: `1px solid ${T.border}`, padding: '3px 8px', borderRadius: 5, fontSize: 10 }}>清除</button>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 8 }}>
                {availStaff.map(s => (
                  <StaffCard key={s.id} s={s} compact selected={selStaff?.id === s.id}
                    onClick={() => s.available !== false && setSelStaff(selStaff?.id === s.id ? null : s)} />
                ))}
              </div>
            </div>
          )}

          {/* 自訂表單 */}
          {customFields.length > 0 && (
            <div style={{ background: T.surface, borderRadius: 14, padding: 16, border: `1px solid ${T.border}` }}>
              <h4 style={{ fontFamily: 'Sora', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>📝 委託資訊</h4>
              <DynamicFormFields fields={customFields} values={formData} onChange={setFormData} />
            </div>
          )}

          <div style={{ background: T.surface, borderRadius: 14, padding: 16, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 11, color: T.textSub, marginBottom: 5 }}>備註</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="想補充的內容..."
              style={{ background: 'rgba(255,255,255,.03)', border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', color: T.text, fontSize: 13, width: '100%', minHeight: 60, resize: 'vertical' }} />
          </div>

          {user && !enoughPoints && (
            <div style={{ background: 'rgba(248,113,113,.08)', color: T.danger, border: `1px solid rgba(248,113,113,.2)`, padding: 12, borderRadius: 10, fontSize: 12, textAlign: 'center' }}>
              點數不足！需要 {pointsCost.toLocaleString()} 點，目前只有 {userPoints.toLocaleString()} 點
            </div>
          )}

          <button onClick={handleOrder} disabled={user && !enoughPoints || submitting} style={{
            background: (!user || enoughPoints) && !submitting ? T.gradBtn : T.surfaceAlt,
            color: (!user || enoughPoints) && !submitting ? '#fff' : T.textMuted,
            border: 'none', padding: '12px', borderRadius: 10, width: '100%', fontSize: 14, fontWeight: 600,
            boxShadow: (!user || enoughPoints) ? `0 4px 16px ${T.accentGlow}` : 'none',
          }}>
            {!user ? '請先登入' : !enoughPoints ? '點數不足' : submitting ? '送出中...' : '確認送出 ✓'}
          </button>
          <button onClick={() => setPath(path.slice(0, -1))} style={{ display: 'block', margin: '0 auto', background: 'transparent', color: T.textSub, border: 'none', fontSize: 12 }}>← 返回</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: path.length === 0 ? 'repeat(auto-fill,minmax(140px,1fr))' : '1fr', gap: 8 }}>
          {currentItems.length === 0 ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', color: T.textMuted, padding: 30, background: T.surface, borderRadius: 12, border: `1px solid ${T.border}` }}>
              {path.length === 0 ? '尚未建立遊戲' : '此分類沒有項目'}
            </div>
          ) : currentItems.map((item, idx) => {
            const isGame = path.length === 0
            const itemPoints = item.points_cost ?? (item.price ? parseInt(String(item.price).replace(/[^\d]/g, '')) || 0 : 0)
            return (
              <div key={item.id} className="fu" onClick={() => setPath([...path, idx])}
                style={{
                  background: T.surface, borderRadius: isGame ? 14 : 10,
                  padding: isGame ? '22px 12px' : '14px 16px',
                  border: `1px solid ${T.border}`, cursor: 'pointer',
                  textAlign: isGame ? 'center' : 'left',
                  display: 'flex', flexDirection: isGame ? 'column' : 'row',
                  alignItems: 'center', gap: isGame ? 8 : 12,
                  justifyContent: isGame ? 'center' : 'space-between',
                  animationDelay: `${idx * .04}s`,
                }}>
                {isGame ? (
                  <>
                    {item.image_url ? (
                      <img src={item.image_url} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 28 }}>{item.icon || '🎮'}</span>
                    )}
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</span>
                    <div style={{ width: 20, height: 2, borderRadius: 1, background: item.color || T.accent, opacity: .6 }} />
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                      {item.image_url && <img src={item.image_url} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                        {item.description && <div style={{ color: T.textSub, fontSize: 11, marginTop: 2 }}>{item.description}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {!item.children?.length && itemPoints > 0 && <span style={{ color: T.gold, fontWeight: 700, fontSize: 12, fontFamily: 'Sora' }}>💎 {itemPoints.toLocaleString()}</span>}
                      <span style={{ color: T.textMuted, fontSize: 14 }}>{item.children?.length ? '›' : '→'}</span>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, val, hl }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
    <span style={{ color: T.textSub, fontSize: 12 }}>{label}</span>
    <span style={{ fontWeight: 600, fontSize: 12, color: hl ? T.gold : T.text, textAlign: 'right', maxWidth: '60%', fontFamily: hl ? 'Sora' : 'inherit' }}>{val}</span>
  </div>
}

// ═══════════ REDEEM CODE ═══════════
// 儲值代碼輸入元件 — 目前是預留 UI，之後接 API 時把 handleRedeem 裡面的 TODO 改成實際呼叫
function RedeemCode({ profileId, reloadProfile }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)  // { type: 'ok' | 'err', text }

  const handleRedeem = async () => {
    const trimmed = code.trim()
    if (!trimmed) return
    setBusy(true)
    setMsg(null)
    try {
      // ─── TODO: 之後接金流 / 兌換 API 時替換以下這段 ───────────────
      //
      // 範例（之後可能長這樣）：
      //   const { data, error } = await supabase.functions.invoke('redeem-code', {
      //     body: { code: trimmed, user_id: profileId }
      //   })
      //   if (error) throw error
      //   setMsg({ type: 'ok', text: `成功儲值 ${data.points} 點！` })
      //   await reloadProfile?.()
      //   setCode('')
      //
      // 目前先顯示「即將開放」訊息，不實際打 API
      await new Promise(r => setTimeout(r, 400))
      setMsg({ type: 'err', text: '儲值功能即將開放，敬請期待 🚧' })
      // ─────────────────────────────────────────────────────────
    } catch (e) {
      setMsg({ type: 'err', text: e.message || '兌換失敗，請稍後再試' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={code}
          onChange={e => { setCode(e.target.value); setMsg(null) }}
          onKeyDown={e => { if (e.key === 'Enter' && !busy) handleRedeem() }}
          placeholder="例如：BIBI-1234-ABCD"
          disabled={busy}
          style={{
            flex: 1, background: 'rgba(255,255,255,.04)',
            border: `1px solid ${T.border}`, borderRadius: 10,
            padding: '10px 14px', color: T.text, fontSize: 13,
            fontFamily: 'Sora', letterSpacing: '0.5px',
          }}
        />
        <button
          onClick={handleRedeem}
          disabled={busy || !code.trim()}
          style={{
            background: (!busy && code.trim()) ? T.gradGold : T.surfaceAlt,
            color: (!busy && code.trim()) ? '#1a1a0e' : T.textMuted,
            border: 'none', padding: '0 22px', borderRadius: 10,
            fontSize: 13, fontWeight: 700, fontFamily: 'Sora',
            cursor: busy || !code.trim() ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {busy ? '驗證中...' : '確認儲值'}
        </button>
      </div>
      {msg && (
        <div style={{
          marginTop: 8, padding: '8px 12px', borderRadius: 8, fontSize: 12,
          background: msg.type === 'ok' ? 'rgba(52,211,153,.1)' : 'rgba(251,191,36,.08)',
          color: msg.type === 'ok' ? T.success : T.gold,
          border: `1px solid ${msg.type === 'ok' ? 'rgba(52,211,153,.2)' : 'rgba(251,191,36,.2)'}`,
        }}>
          {msg.text}
        </div>
      )}
    </div>
  )
}

// ═══════════ PROFILE ═══════════
function ProfilePage({ profile, orders, staff, isDesktop, loadOrders, reloadProfile }) {
  const [gmail, setGmail] = useState(profile?.gmail || '')
  const [gmailSaved, setGmailSaved] = useState(false)
  const [gmailEditing, setGmailEditing] = useState(false)
  const [cancelling, setCancelling] = useState(null)
  const [tab, setTab] = useState('current')

  useEffect(() => { setGmail(profile?.gmail || '') }, [profile?.gmail])

  const cancelOrder = async (id) => {
    if (!confirm('確定要取消這筆訂單嗎？')) return
    setCancelling(id)
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', id)
    await loadOrders()
    setCancelling(null)
  }

  const saveGmail = async () => {
    const { error } = await supabase.from('profiles').update({ gmail }).eq('id', profile.id)
    if (!error) {
      setGmailSaved(true); setGmailEditing(false)
      reloadProfile && reloadProfile()
      setTimeout(() => setGmailSaved(false), 2000)
    }
  }

  const discordName = profile?.name || '用戶'
  const avatarUrl = profile?.avatar_url
  const points = profile?.points || 0

  // 訂單分兩類：目前訂單（等待中+進行中）/ 歷史訂單（已完成+已取消）
  const tabbed = {
    current: orders.filter(o => o.status === 'pending' || o.status === 'accepted'),
    history: orders.filter(o => o.status === 'completed' || o.status === 'cancelled'),
  }
  const tabConfig = [
    { k: 'current', l: '目前訂單', n: tabbed.current.length, c: T.accent },
    { k: 'history', l: '歷史訂單', n: tabbed.history.length, c: T.textSub },
  ]
  const currentList = tabbed[tab] || []

  // staff lookup for showing avatars in completed orders
  const staffMap = {}
  staff.forEach(s => { staffMap[s.id] = s })

  return (
    <div>
      <div className="fu" style={{ background: T.surface, borderRadius: 16, padding: isDesktop ? 28 : 22, border: `1px solid ${T.border}`, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="" style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: T.gradBtn, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#fff', fontFamily: 'Sora', flexShrink: 0 }}>{discordName[0]}</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Sora' }}>{discordName}</div>
            <div style={{ color: T.textSub, fontSize: 12, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <DiscordIcon w={14} h={11} fill="#5865F2" />
              Discord 登入
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Sora' }}>{orders.length}</div>
            <div style={{ fontSize: 11, color: T.textSub }}>總訂單</div>
          </div>
        </div>

        {/* 點數區塊：餘額 + 儲值代碼 */}
        <div style={{
          background: `linear-gradient(135deg,${T.goldSoft},rgba(245,158,11,.04))`,
          borderRadius: 14, padding: '18px 22px',
          border: `1px solid rgba(251,191,36,.2)`,
          marginBottom: 12,
        }}>
          {/* 上半：餘額顯示 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: T.textSub, marginBottom: 4, fontWeight: 600, letterSpacing: '1px' }}>🪙 點數餘額</div>
            <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'Sora', color: T.gold, lineHeight: 1 }}>{points.toLocaleString('zh-TW')}</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>用於下單委託</div>
          </div>

          {/* 下半：儲值代碼輸入 */}
          <div style={{ paddingTop: 14, borderTop: `1px dashed rgba(251,191,36,.25)` }}>
            <div style={{ fontSize: 11, color: T.textSub, marginBottom: 8, fontWeight: 600, letterSpacing: '1px' }}>輸入儲值代碼</div>
            <RedeemCode profileId={profile?.id} reloadProfile={reloadProfile} />
          </div>
        </div>

        {/* Gmail 綁定區塊 */}
        <div style={{
          background: T.surfaceAlt, borderRadius: 12, padding: '14px 18px',
          border: `1px solid ${T.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: gmailEditing ? 10 : 0, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ fontSize: 16 }}>📧</span>
              <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile?.gmail ? profile.gmail : 'Gmail 尚未綁定'}
              </span>
              {gmailSaved && <span style={{ color: T.success, fontSize: 11 }}>✓ 已儲存</span>}
            </div>
            <button onClick={() => setGmailEditing(!gmailEditing)} style={{
              background: 'rgba(255,255,255,.04)', color: T.textSub,
              border: `1px solid ${T.border}`, padding: '4px 12px',
              borderRadius: 6, fontSize: 11,
            }}>{gmailEditing ? '取消' : profile?.gmail ? '修改' : '綁定'}</button>
          </div>
          {gmailEditing && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={gmail} onChange={e => setGmail(e.target.value)}
                placeholder="your@gmail.com" type="email"
                style={{
                  flex: 1, background: 'rgba(255,255,255,.04)', border: `1px solid ${T.border}`,
                  borderRadius: 8, padding: '8px 12px', color: T.text, fontSize: 13,
                }} />
              <button onClick={saveGmail} style={{
                background: T.gradBtn, color: '#fff', border: 'none',
                padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              }}>儲存</button>
            </div>
          )}
        </div>
      </div>

      {/* 訂單 Tabs */}
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontFamily: 'Sora', fontSize: 18, fontWeight: 700, marginBottom: 12 }}>📋 我的訂單</h2>
        <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: T.surface, borderRadius: 10, padding: 4, border: `1px solid ${T.border}` }}>
          {tabConfig.map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} style={{
              flex: 1, background: tab === t.k ? T.surfaceAlt : 'transparent',
              color: tab === t.k ? t.c : T.textSub,
              border: 'none', padding: '8px 12px', borderRadius: 8,
              fontSize: 13, fontWeight: tab === t.k ? 700 : 500,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              {t.l}
              {t.n > 0 && (
                <span style={{
                  background: tab === t.k ? `${t.c}20` : T.surfaceAlt,
                  color: tab === t.k ? t.c : T.textMuted,
                  padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700, fontFamily: 'Sora',
                }}>{t.n}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {currentList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: T.textMuted, background: T.surface, borderRadius: 14, border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
          <div style={{ fontSize: 14 }}>
            {tab === 'current' ? '目前沒有進行中的訂單' : '還沒有歷史訂單'}
          </div>
        </div>
      ) : currentList.map(o => {
        const st = STATUS[o.status]
        const orderStaff = o.staff_id ? staffMap[o.staff_id] : null
        const formData = o.form_data && typeof o.form_data === 'object' ? o.form_data : {}
        const hasFormData = Object.keys(formData).length > 0
        return (
          <div key={o.id} style={{ background: T.surface, borderRadius: 12, padding: '16px 18px', border: `1px solid ${T.border}`, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>{o.game_icon || '🎮'}</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{o.game_name}</span>
              </div>
              <span style={{ background: `${st.color}15`, color: st.color, padding: '3px 10px', borderRadius: 16, fontSize: 11, fontWeight: 600 }}>{st.icon} {st.label}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: T.textSub }}>{o.service_path}</span>
              <span style={{ color: T.gold, fontWeight: 700, fontFamily: 'Sora' }}>💎 {(o.points_cost || 0).toLocaleString('zh-TW')}</span>
            </div>

            {/* 員工資訊 */}
            {(o.staff_name || orderStaff) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '8px 10px', background: T.surfaceAlt, borderRadius: 8, border: `1px solid ${T.border}` }}>
                {orderStaff?.avatar_url ? (
                  <img src={orderStaff.avatar_url} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: T.gradBtn, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>{(o.staff_name || '?')[0]}</div>
                )}
                <span style={{ fontSize: 11, color: T.textSub }}>
                  {o.status === 'completed' ? '由' : '指定'} <span style={{ color: T.text, fontWeight: 600 }}>{o.staff_name}</span> {o.status === 'completed' ? '完成' : '服務'}
                </span>
              </div>
            )}

            {/* 委託資訊（form_data） */}
            {hasFormData && (
              <div style={{ marginTop: 8, padding: '8px 10px', background: T.surfaceAlt, borderRadius: 8, fontSize: 11 }}>
                {Object.entries(formData).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
                    <span style={{ color: T.textMuted, minWidth: 60 }}>{k}：</span>
                    <span style={{ color: T.textSub }}>{Array.isArray(v) ? v.join('、') : String(v)}</span>
                  </div>
                ))}
              </div>
            )}

            {o.note && <div style={{ marginTop: 6, fontSize: 12, color: T.textMuted }}>💬 {o.note}</div>}
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontSize: 10, color: T.textMuted }}>#{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleString('zh-TW')}</span>
              {o.status === 'pending' && (
                <button onClick={() => cancelOrder(o.id)} disabled={cancelling === o.id} style={{
                  background: 'rgba(248,113,113,.08)', color: T.danger,
                  border: `1px solid rgba(248,113,113,.15)`, padding: '4px 12px',
                  borderRadius: 6, fontSize: 11, fontWeight: 500,
                  opacity: cancelling === o.id ? .5 : 1,
                }}>{cancelling === o.id ? '取消中...' : '取消訂單'}</button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═══════════ ADMIN — 工具包式後台 ═══════════
// ─────────────────────────────────────────────────────────────
// 工具包註冊表：
//   要新增工具包，只要：
//     1. 寫一個新的 React 元件（接收 ctx prop，從中拿到所需資料）
//     2. 在下面 ADMIN_TOOLS 陣列加一筆 { id, label, group, icon, render }
//   左側選單會自動長出來，不用改其他地方。
// ─────────────────────────────────────────────────────────────

// ─── 線條 icons（內嵌 SVG，避免裝額外套件） ───
const Icon = {
  catalog: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  staff: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  orders: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>,
  home: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  chevron: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  collapse: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  menu: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
}

// ─── 工具包註冊表 ───
const ADMIN_TOOLS = [
  {
    id: 'catalog',
    label: '品項管理',
    group: '營運',
    icon: 'catalog',
    description: '上下架商品、設定點數、上傳圖片、自訂下單表單',
    render: (ctx) => <CatalogAdmin catalog={ctx.catalog} tree={ctx.catalogTree} reload={ctx.reload} />,
  },
  {
    id: 'staff',
    label: '員工管理',
    group: '營運',
    icon: 'staff',
    description: '新增員工、設定接單狀態與標籤',
    render: (ctx) => <StaffAdmin staff={ctx.staff} reload={ctx.reloadStaff} />,
  },
  {
    id: 'orders',
    label: '訂單管理',
    group: '營運',
    icon: 'orders',
    description: '查看所有訂單、指派員工、更新狀態',
    onActivate: (ctx) => ctx.loadOrders?.(),
    render: (ctx) => <OrderAdmin orders={ctx.orders} loadOrders={ctx.loadOrders} staff={ctx.staff} />,
  },
  {
    id: 'announcements',
    label: '主頁管理',
    group: '內容',
    icon: 'home',
    description: '管理首頁公告、可附帶連結',
    render: (ctx) => <AnnouncementAdmin ann={ctx.ann} reload={ctx.reloadAnnouncements} />,
  },
  // 之後要加新工具，在這裡加一筆即可
  // { id: 'finance', label: '會計報表', group: '財務', icon: '...', render: (ctx) => <FinanceAdmin /> },
]

function AdminPage(ctx) {
  const [activeId, setActiveId] = useState(ADMIN_TOOLS[0].id)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isDesktop = useIsDesktop(900)
  const active = ADMIN_TOOLS.find(t => t.id === activeId) || ADMIN_TOOLS[0]

  // 切換工具時觸發 onActivate（例如載入訂單）
  useEffect(() => {
    active?.onActivate?.(ctx)
    setSidebarOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  // 把工具按 group 分組（保留註冊順序）
  const groups = []
  const groupMap = {}
  ADMIN_TOOLS.forEach(t => {
    const g = t.group || '其他'
    if (!groupMap[g]) {
      groupMap[g] = { name: g, items: [] }
      groups.push(groupMap[g])
    }
    groupMap[g].items.push(t)
  })

  const SidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ padding: '4px 14px 14px', borderBottom: `1px solid ${T.border}`, marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: '1.5px', fontWeight: 600, marginBottom: 4 }}>BIBILAPU</div>
        <div style={{ fontFamily: 'Sora', fontSize: 16, fontWeight: 700 }}>後台管理</div>
      </div>
      {groups.map(g => (
        <div key={g.name} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, letterSpacing: '1.5px', padding: '6px 14px 4px' }}>{g.name.toUpperCase()}</div>
          {g.items.map(t => {
            const isActive = activeId === t.id
            return (
              <button key={t.id} onClick={() => setActiveId(t.id)} style={{
                background: isActive ? T.accentSoft : 'transparent',
                color: isActive ? T.accent : T.textSub,
                border: 'none', padding: '9px 14px', borderRadius: 8,
                fontSize: 13, fontWeight: isActive ? 600 : 500,
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', textAlign: 'left', cursor: 'pointer',
                transition: 'all .15s',
                position: 'relative',
              }}>
                {isActive && <span style={{ position: 'absolute', left: 0, top: '20%', height: '60%', width: 2, borderRadius: '0 2px 2px 0', background: T.accent }} />}
                <span style={{ display: 'inline-flex', opacity: isActive ? 1 : .6 }}>{Icon[t.icon] || Icon.catalog}</span>
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '220px 1fr' : '1fr', gap: isDesktop ? 18 : 0, alignItems: 'start' }}>
      {/* 桌面版側邊欄 */}
      {isDesktop && (
        <aside style={{
          background: T.surface, borderRadius: 14, border: `1px solid ${T.border}`,
          padding: '18px 8px', position: 'sticky', top: 76, alignSelf: 'start',
        }}>
          {SidebarContent}
        </aside>
      )}

      {/* 手機版工具切換按鈕 */}
      {!isDesktop && (
        <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
          background: T.surface, color: T.text,
          border: `1px solid ${T.border}`, borderRadius: 10,
          padding: '10px 14px', marginBottom: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', cursor: 'pointer',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {Icon.menu}
            <span style={{ fontSize: 13, fontWeight: 600 }}>{active.label}</span>
          </span>
          <span style={{ color: T.textMuted, transform: sidebarOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>{Icon.collapse}</span>
        </button>
      )}

      {/* 手機版下拉選單 */}
      {!isDesktop && sidebarOpen && (
        <div style={{ background: T.surface, borderRadius: 14, border: `1px solid ${T.border}`, padding: '10px 6px', marginBottom: 14 }}>
          {SidebarContent}
        </div>
      )}

      {/* 內容區 */}
      <main style={{ minWidth: 0 }}>
        <div className="fi" style={{ marginBottom: 16 }}>
          <h1 style={{ fontFamily: 'Sora', fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{active.label}</h1>
          {active.description && <p style={{ color: T.textSub, fontSize: 13 }}>{active.description}</p>}
        </div>
        <div className="fi">
          {active.render(ctx)}
        </div>
      </main>
    </div>
  )
}

// ═══════════ COLLAPSIBLE SECTION（給工具內部用，避免內容凌亂） ═══════════
function Collapsible({ title, count, children, defaultOpen = false, accent }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{
      background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`,
      marginBottom: 8, overflow: 'hidden',
    }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', background: 'transparent', border: 'none',
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
        color: T.text, cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{ color: open ? (accent || T.accent) : T.textMuted, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s', display: 'inline-flex' }}>
          {Icon.chevron}
        </span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{title}</span>
        {count !== undefined && (
          <span style={{ fontSize: 10, color: T.textMuted, background: T.surfaceAlt, padding: '2px 8px', borderRadius: 10, fontFamily: 'Sora', fontWeight: 600 }}>
            {count}
          </span>
        )}
      </button>
      {open && (
        <div className="fi" style={{ padding: '4px 16px 14px', borderTop: `1px solid ${T.border}` }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ═══════════ CATALOG ADMIN ═══════════
function CatalogAdmin({ catalog, tree, reload }) {
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({})
  const [showForm, setShowForm] = useState(false) // 是否在編輯表單欄位
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const startEdit = (node) => {
    setEditId(node.id)
    setForm({
      name: node.name,
      icon: node.icon || '',
      color: node.color || '',
      price: node.price || '',
      points_cost: node.points_cost ?? 0,
      description: node.description || '',
      sort_order: node.sort_order || 0,
      image_url: node.image_url || '',
      form_fields: Array.isArray(node.form_fields) ? node.form_fields : [],
    })
    setShowForm(false)
  }

  const saveEdit = async () => {
    const payload = {
      name: form.name,
      icon: form.icon,
      color: form.color,
      price: form.price,
      points_cost: parseInt(form.points_cost) || 0,
      description: form.description,
      sort_order: form.sort_order,
      image_url: form.image_url,
      form_fields: form.form_fields,
    }
    const { error } = await supabase.from('catalog').update(payload).eq('id', editId)
    if (error) { alert('儲存失敗：' + error.message); return }
    setEditId(null)
    reload()
  }

  const addChild = async (parentId) => {
    const siblings = catalog.filter(c => c.parent_id === parentId)
    await supabase.from('catalog').insert({
      parent_id: parentId || null,
      name: '新項目',
      sort_order: siblings.length + 1,
    })
    reload()
  }

  const deleteNode = async (id, name) => {
    if (!confirm(`確定刪除「${name}」及其所有子項目？`)) return
    await supabase.from('catalog').delete().eq('id', id)
    reload()
  }

  const handleUpload = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `catalog_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase.storage.from('catalog-images').upload(fileName, file, { upsert: false })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('catalog-images').getPublicUrl(fileName)
      setForm(f => ({ ...f, image_url: data.publicUrl }))
    } catch (e) {
      alert('上傳失敗：' + e.message)
    } finally {
      setUploading(false)
    }
  }

  const renderTree = (nodes, depth = 0) => {
    const dc = ['#818CF8', '#C084FC', '#F472B6', '#FBBF24', '#34D399']
    return (
      <div style={{ marginLeft: depth > 0 ? 14 : 0 }}>
        {nodes.map((n) => (
          <div key={n.id} style={{ marginBottom: 3 }}>
            <div style={{
              background: T.surface, borderRadius: 8, borderLeft: `3px solid ${n.color || dc[depth % 5]}`,
              border: `1px solid ${T.border}`, padding: editId === n.id ? '12px 14px' : '7px 12px',
              display: 'flex', flexDirection: 'column', gap: editId === n.id ? 10 : 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {n.children?.length > 0 && <span style={{ fontSize: 9, color: T.textMuted }}>▼</span>}
                {depth === 0 && (
                  n.image_url ? (
                    <img src={n.image_url} alt="" style={{ width: 22, height: 22, borderRadius: 4, objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 14 }}>{n.icon || '🎮'}</span>
                  )
                )}
                <span style={{ flex: 1, fontSize: 12, fontWeight: depth === 0 ? 700 : 500 }}>{n.name}</span>
                {n.points_cost > 0 && <span style={{ fontSize: 10, color: T.gold, fontWeight: 700, fontFamily: 'Sora' }}>💎 {n.points_cost.toLocaleString()}</span>}
                {Array.isArray(n.form_fields) && n.form_fields.length > 0 && <span style={{ fontSize: 9, color: T.accent, background: T.accentSoft, padding: '1px 6px', borderRadius: 4 }}>📝 {n.form_fields.length}</span>}
                <div style={{ display: 'flex', gap: 2 }}>
                  <Mb onClick={() => startEdit(n)}>✎</Mb>
                  <Mb onClick={() => addChild(n.id)}>+</Mb>
                  <Mb onClick={() => deleteNode(n.id, n.name)} d>✕</Mb>
                </div>
              </div>

              {editId === n.id && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 18 }}>
                  {/* 基本欄位 */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Si label="名稱" val={form.name} onChange={v => setForm({ ...form, name: v })} flex={2} />
                    {depth === 0 && <Si label="Emoji 圖示" val={form.icon} onChange={v => setForm({ ...form, icon: v })} w={80} />}
                    {depth === 0 && <Si label="色碼" val={form.color} onChange={v => setForm({ ...form, color: v })} w={80} />}
                    <Si label="排序" val={String(form.sort_order)} onChange={v => setForm({ ...form, sort_order: parseInt(v) || 0 })} w={55} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Si label="點數" val={String(form.points_cost)} onChange={v => setForm({ ...form, points_cost: parseInt(v) || 0 })} w={90} />
                    <Si label="價格標籤（顯示用）" val={form.price} onChange={v => setForm({ ...form, price: v })} flex={1} />
                    <Si label="說明" val={form.description} onChange={v => setForm({ ...form, description: v })} flex={2} />
                  </div>

                  {/* 圖片上傳 */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 600, letterSpacing: '1px' }}>圖片</div>
                    {form.image_url && (
                      <img src={form.image_url} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', border: `1px solid ${T.border}` }} />
                    )}
                    <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => handleUpload(e.target.files?.[0])} />
                    <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{
                      background: T.surfaceAlt, color: T.textSub, border: `1px solid ${T.border}`,
                      padding: '5px 12px', borderRadius: 6, fontSize: 11, opacity: uploading ? .5 : 1,
                    }}>{uploading ? '上傳中...' : form.image_url ? '更換圖片' : '上傳圖片'}</button>
                    {form.image_url && (
                      <button onClick={() => setForm({ ...form, image_url: '' })} style={{
                        background: 'rgba(248,113,113,.08)', color: T.danger, border: `1px solid rgba(248,113,113,.15)`,
                        padding: '5px 10px', borderRadius: 6, fontSize: 11,
                      }}>移除</button>
                    )}
                    <Si label="或貼上圖片網址" val={form.image_url} onChange={v => setForm({ ...form, image_url: v })} flex={2} />
                  </div>

                  {/* 表單欄位編輯（只在有價格的葉子有意義，但全開放） */}
                  <div>
                    <button onClick={() => setShowForm(!showForm)} style={{
                      background: showForm ? T.accentSoft : T.surfaceAlt,
                      color: showForm ? T.accent : T.textSub,
                      border: `1px solid ${showForm ? T.accent : T.border}`,
                      padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    }}>📝 自訂表單欄位 ({form.form_fields.length}) {showForm ? '▲' : '▼'}</button>
                    {showForm && (
                      <FormFieldsEditor
                        fields={form.form_fields}
                        onChange={ff => setForm({ ...form, form_fields: ff })}
                      />
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={saveEdit} style={{ background: T.gradBtn, color: '#fff', border: 'none', padding: '7px 18px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>儲存</button>
                    <button onClick={() => setEditId(null)} style={{ background: 'transparent', color: T.textSub, border: `1px solid ${T.border}`, padding: '7px 18px', borderRadius: 6, fontSize: 12 }}>取消</button>
                  </div>
                </div>
              )}
            </div>
            {n.children?.length > 0 && renderTree(n.children, depth + 1)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      {tree.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 30, color: T.textMuted, background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, marginBottom: 8 }}>
          目前沒有任何品項，點下方按鈕新增第一個遊戲
        </div>
      ) : renderTree(tree)}
      <button onClick={() => addChild(null)} style={{ background: T.accentSoft, color: T.accent, border: `1px dashed rgba(129,140,248,.25)`, padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500, width: '100%', marginTop: 8 }}>+ 新增遊戲</button>
    </div>
  )
}

// ═══════════ FORM FIELDS EDITOR ═══════════
function FormFieldsEditor({ fields, onChange }) {
  const update = (idx, patch) => {
    const next = fields.map((f, i) => i === idx ? { ...f, ...patch } : f)
    onChange(next)
  }
  const remove = (idx) => onChange(fields.filter((_, i) => i !== idx))
  const move = (idx, dir) => {
    const target = idx + dir
    if (target < 0 || target >= fields.length) return
    const next = [...fields]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onChange(next)
  }
  const add = () => {
    const key = `field_${fields.length + 1}_${Math.random().toString(36).slice(2, 6)}`
    onChange([...fields, { key, label: '新欄位', type: 'text', required: false, placeholder: '', options: [] }])
  }

  const needsOptions = (t) => ['select', 'radio', 'checkbox'].includes(t)

  return (
    <div style={{ marginTop: 10, padding: 12, background: T.surfaceAlt, borderRadius: 8, border: `1px dashed ${T.border}` }}>
      {fields.length === 0 && (
        <div style={{ color: T.textMuted, fontSize: 11, textAlign: 'center', padding: 8 }}>尚未設定欄位，點下方新增</div>
      )}
      {fields.map((f, idx) => (
        <div key={idx} style={{ background: T.surface, borderRadius: 6, padding: 10, marginBottom: 8, border: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 6 }}>
            <Si label="欄位名稱" val={f.label || ''} onChange={v => update(idx, { label: v })} flex={2} />
            <div style={{ width: 100 }}>
              <div style={{ fontSize: 9, color: T.textMuted, marginBottom: 2 }}>類型</div>
              <select value={f.type || 'text'} onChange={e => update(idx, { type: e.target.value })} style={{
                background: 'rgba(255,255,255,.03)', border: `1px solid ${T.border}`,
                borderRadius: 5, padding: '5px 8px', color: T.text, fontSize: 11, width: '100%',
              }}>
                {FIELD_TYPES.map(ft => <option key={ft.v} value={ft.v}>{ft.l}</option>)}
              </select>
            </div>
            <Si label="提示文字" val={f.placeholder || ''} onChange={v => update(idx, { placeholder: v })} flex={2} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: T.textSub, paddingBottom: 5 }}>
              <input type="checkbox" checked={!!f.required} onChange={e => update(idx, { required: e.target.checked })} style={{ accentColor: T.accent }} />
              必填
            </label>
          </div>
          {needsOptions(f.type) && (
            <div style={{ marginBottom: 6 }}>
              <Si
                label={`選項（用逗號分隔）`}
                val={Array.isArray(f.options) ? f.options.join(',') : (f.options || '')}
                onChange={v => update(idx, { options: v.split(',').map(x => x.trim()).filter(Boolean) })}
                flex={1}
              />
            </div>
          )}
          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
            <button onClick={() => move(idx, -1)} disabled={idx === 0} style={miniBtnStyle(false)}>↑</button>
            <button onClick={() => move(idx, 1)} disabled={idx === fields.length - 1} style={miniBtnStyle(false)}>↓</button>
            <button onClick={() => remove(idx)} style={miniBtnStyle(true)}>刪除</button>
          </div>
        </div>
      ))}
      <button onClick={add} style={{
        background: T.accentSoft, color: T.accent,
        border: `1px dashed rgba(129,140,248,.3)`, padding: '6px 14px',
        borderRadius: 6, fontSize: 11, fontWeight: 600, width: '100%',
      }}>+ 新增欄位</button>
    </div>
  )
}

function miniBtnStyle(d) {
  return {
    background: d ? 'rgba(248,113,113,.06)' : 'rgba(255,255,255,.03)',
    color: d ? T.danger : T.textSub,
    border: `1px solid ${d ? 'rgba(248,113,113,.12)' : T.border}`,
    borderRadius: 4, padding: '3px 8px', fontSize: 10,
  }
}

// ═══════════ STAFF ADMIN ═══════════
function StaffAdmin({ staff, reload }) {
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({})
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const startEdit = (s) => {
    setEditId(s.id)
    setForm({
      name: s.name || '',
      avatar_url: s.avatar_url || '',
      tags: Array.isArray(s.tags) ? s.tags.join(',') : (s.tags || ''),
      games: Array.isArray(s.games) ? s.games.join(',') : (s.games || ''),
      bio: s.bio || '',
      sort_order: s.sort_order || 0,
      active: s.active !== false,
      available: s.available !== false,
    })
  }

  const newStaff = async () => {
    const { data, error } = await supabase.from('staff').insert({
      name: '新員工',
      sort_order: staff.length + 1,
      active: true,
      available: true,
    }).select().single()
    if (error) { alert('新增失敗：' + error.message); return }
    await reload()
    if (data) startEdit(data)
  }

  const saveEdit = async () => {
    const payload = {
      name: form.name,
      avatar_url: form.avatar_url,
      tags: form.tags ? form.tags.split(',').map(x => x.trim()).filter(Boolean) : [],
      games: form.games ? form.games.split(',').map(x => x.trim()).filter(Boolean) : [],
      bio: form.bio,
      sort_order: parseInt(form.sort_order) || 0,
      active: form.active,
      available: form.available,
    }
    const { error } = await supabase.from('staff').update(payload).eq('id', editId)
    if (error) { alert('儲存失敗：' + error.message); return }
    setEditId(null)
    reload()
  }

  const deleteStaff = async (id, name) => {
    if (!confirm(`確定刪除員工「${name}」？`)) return
    await supabase.from('staff').delete().eq('id', id)
    reload()
  }

  const handleUpload = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `staff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase.storage.from('catalog-images').upload(fileName, file, { upsert: false })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('catalog-images').getPublicUrl(fileName)
      setForm(f => ({ ...f, avatar_url: data.publicUrl }))
    } catch (e) {
      alert('上傳失敗：' + e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      {staff.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 30, color: T.textMuted, background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, marginBottom: 8 }}>
          目前沒有員工，點下方按鈕新增
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {staff.map(s => (
            <div key={s.id} style={{
              background: T.surface, borderRadius: 8, border: `1px solid ${T.border}`,
              padding: editId === s.id ? '14px 16px' : '10px 14px',
              display: 'flex', flexDirection: 'column', gap: editId === s.id ? 10 : 0,
              opacity: s.active === false ? .55 : 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {s.avatar_url ? (
                  <img src={s.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: T.gradBtn, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>{(s.name || '?')[0]}</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</div>
                  <div style={{ fontSize: 10, color: T.textMuted, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {Array.isArray(s.games) && s.games.length > 0 && <span>🎮 {s.games.join(', ')}</span>}
                    {Array.isArray(s.tags) && s.tags.length > 0 && <span>🏷️ {s.tags.join(', ')}</span>}
                  </div>
                </div>
                {!s.active && <span style={{ fontSize: 9, padding: '2px 6px', background: T.surfaceAlt, color: T.textMuted, borderRadius: 4 }}>停用</span>}
                {s.active && !s.available && <span style={{ fontSize: 9, padding: '2px 6px', background: 'rgba(251,191,36,.1)', color: T.warn, borderRadius: 4 }}>暫停接單</span>}
                <div style={{ display: 'flex', gap: 2 }}>
                  <Mb onClick={() => editId === s.id ? setEditId(null) : startEdit(s)}>✎</Mb>
                  <Mb onClick={() => deleteStaff(s.id, s.name)} d>✕</Mb>
                </div>
              </div>

              {editId === s.id && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 0 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Si label="姓名" val={form.name} onChange={v => setForm({ ...form, name: v })} flex={2} />
                    <Si label="排序" val={String(form.sort_order)} onChange={v => setForm({ ...form, sort_order: parseInt(v) || 0 })} w={55} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    {form.avatar_url && <img src={form.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${T.border}` }} />}
                    <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => handleUpload(e.target.files?.[0])} />
                    <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{
                      background: T.surfaceAlt, color: T.textSub, border: `1px solid ${T.border}`,
                      padding: '5px 12px', borderRadius: 6, fontSize: 11, opacity: uploading ? .5 : 1,
                    }}>{uploading ? '上傳中...' : form.avatar_url ? '更換頭像' : '上傳頭像'}</button>
                    <Si label="或貼上頭像網址" val={form.avatar_url} onChange={v => setForm({ ...form, avatar_url: v })} flex={2} />
                  </div>
                  <Si label="標籤（逗號分隔）" val={form.tags} onChange={v => setForm({ ...form, tags: v })} flex={1} />
                  <Si label="擅長遊戲（逗號分隔）" val={form.games} onChange={v => setForm({ ...form, games: v })} flex={1} />
                  <Si label="簡介" val={form.bio} onChange={v => setForm({ ...form, bio: v })} flex={1} />
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textSub }}>
                      <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} style={{ accentColor: T.accent }} />
                      啟用
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textSub }}>
                      <input type="checkbox" checked={form.available} onChange={e => setForm({ ...form, available: e.target.checked })} style={{ accentColor: T.accent }} />
                      接單中
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={saveEdit} style={{ background: T.gradBtn, color: '#fff', border: 'none', padding: '7px 18px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>儲存</button>
                    <button onClick={() => setEditId(null)} style={{ background: 'transparent', color: T.textSub, border: `1px solid ${T.border}`, padding: '7px 18px', borderRadius: 6, fontSize: 12 }}>取消</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <button onClick={newStaff} style={{ background: T.accentSoft, color: T.accent, border: `1px dashed rgba(129,140,248,.25)`, padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500, width: '100%', marginTop: 8 }}>+ 新增員工</button>
    </div>
  )
}

// ═══════════ ORDER ADMIN ═══════════
function OrderAdmin({ orders, loadOrders, staff }) {
  const [filter, setFilter] = useState('all')

  const updateStatus = async (id, status) => {
    await supabase.from('orders').update({ status }).eq('id', id)
    loadOrders()
  }

  const assignStaff = async (id, staffMember) => {
    await supabase.from('orders').update({
      staff_id: staffMember?.id || null,
      staff_name: staffMember?.name || null,
    }).eq('id', id)
    loadOrders()
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { k: 'all', l: '全部', n: orders.length },
          { k: 'pending', l: '待接單', n: orders.filter(o => o.status === 'pending').length },
          { k: 'accepted', l: '進行中', n: orders.filter(o => o.status === 'accepted').length },
          { k: 'completed', l: '已完成', n: orders.filter(o => o.status === 'completed').length },
          { k: 'cancelled', l: '已取消', n: orders.filter(o => o.status === 'cancelled').length },
        ].map(t => (
          <button key={t.k} onClick={() => setFilter(t.k)} style={{
            background: filter === t.k ? T.accentSoft : 'transparent',
            color: filter === t.k ? T.accent : T.textSub,
            border: `1px solid ${filter === t.k ? 'rgba(129,140,248,.2)' : T.border}`,
            padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
          }}>{t.l} {t.n > 0 && <span style={{ marginLeft: 4, fontSize: 10, opacity: .7 }}>({t.n})</span>}</button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: T.textMuted, background: T.surface, borderRadius: 14, border: `1px solid ${T.border}` }}>沒有訂單</div>
      ) : filtered.map(o => {
        const st = STATUS[o.status]
        const formData = o.form_data && typeof o.form_data === 'object' ? o.form_data : {}
        const hasFormData = Object.keys(formData).length > 0
        return (
          <div key={o.id} style={{ background: T.surface, borderRadius: 10, padding: '14px 16px', border: `1px solid ${T.border}`, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>{o.game_icon || '🎮'}</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{o.game_name}</span>
                <span style={{ color: T.textSub, fontSize: 11 }}>— {o.service_path}</span>
              </div>
              <span style={{ background: `${st.color}15`, color: st.color, padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600 }}>{st.icon} {st.label}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.textMuted, marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
              <span>#{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleString('zh-TW')}</span>
              <span style={{ color: T.gold, fontWeight: 700, fontFamily: 'Sora' }}>💎 {(o.points_cost || 0).toLocaleString('zh-TW')} 點</span>
            </div>
            {o.staff_name && (
              <div style={{ fontSize: 11, color: T.textSub, marginBottom: 6 }}>👤 員工：<span style={{ color: T.text, fontWeight: 600 }}>{o.staff_name}</span></div>
            )}
            {hasFormData && (
              <div style={{ marginTop: 6, padding: '6px 10px', background: T.surfaceAlt, borderRadius: 6, fontSize: 10 }}>
                {Object.entries(formData).map(([k, v]) => (
                  <div key={k}><span style={{ color: T.textMuted }}>{k}：</span><span style={{ color: T.textSub }}>{Array.isArray(v) ? v.join('、') : String(v)}</span></div>
                ))}
              </div>
            )}
            {o.note && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>💬 {o.note}</div>}

            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {/* 員工指派 */}
              <select value={o.staff_id || ''} onChange={e => {
                const s = staff.find(x => x.id === e.target.value)
                assignStaff(o.id, s || null)
              }} style={{
                background: 'rgba(255,255,255,.03)', border: `1px solid ${T.border}`,
                borderRadius: 5, padding: '3px 8px', color: T.text, fontSize: 11,
              }}>
                <option value="">未指派員工</option>
                {staff.filter(s => s.active !== false).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {/* 狀態切換 */}
              <div style={{ display: 'flex', gap: 3 }}>
                {['pending', 'accepted', 'completed', 'cancelled'].map(s => (
                  <button key={s} onClick={() => updateStatus(o.id, s)} style={{
                    background: o.status === s ? `${STATUS[s].color}18` : 'rgba(255,255,255,.02)',
                    color: o.status === s ? STATUS[s].color : T.textMuted,
                    border: `1px solid ${o.status === s ? STATUS[s].color + '25' : T.border}`,
                    padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 500,
                  }}>{STATUS[s].label}</button>
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═══════════ ANNOUNCEMENT ADMIN ═══════════
function AnnouncementAdmin({ ann, reload }) {
  const [editing, setEditing] = useState(null)  // null | { id, ... } | 'new'
  const [form, setForm] = useState({ title: '', body: '', link_url: '', link_label: '' })
  const [saving, setSaving] = useState(false)

  const startNew = () => {
    setForm({ title: '', body: '', link_url: '', link_label: '' })
    setEditing('new')
  }

  const startEdit = (a) => {
    setForm({
      title: a.title || '',
      body: a.body || '',
      link_url: a.link_url || '',
      link_label: a.link_label || '',
    })
    setEditing(a)
  }

  const cancel = () => { setEditing(null); setForm({ title: '', body: '', link_url: '', link_label: '' }) }

  const save = async () => {
    if (!form.title.trim()) { alert('請填寫標題'); return }
    if (form.link_url && !/^https?:\/\//i.test(form.link_url.trim())) {
      alert('連結必須以 http:// 或 https:// 開頭'); return
    }
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      link_url: form.link_url.trim() || null,
      link_label: form.link_label.trim() || null,
    }
    let error
    if (editing === 'new') {
      const res = await supabase.from('announcements').insert({
        ...payload,
        published_at: new Date().toISOString(),
      })
      error = res.error
    } else {
      const res = await supabase.from('announcements').update(payload).eq('id', editing.id)
      error = res.error
    }
    setSaving(false)
    if (error) { alert('儲存失敗：' + error.message); return }
    cancel()
    reload?.()
  }

  const del = async (a) => {
    if (!confirm(`確定刪除公告「${a.title}」？`)) return
    await supabase.from('announcements').delete().eq('id', a.id)
    reload?.()
  }

  const Editor = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Si label="標題（必填）" val={form.title} onChange={v => setForm({ ...form, title: v })} flex={1} />
      <div>
        <div style={{ fontSize: 9, color: T.textMuted, marginBottom: 2 }}>內文</div>
        <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })}
          placeholder="公告詳細內容..." style={{
            background: 'rgba(255,255,255,.03)', border: `1px solid ${T.border}`,
            borderRadius: 5, padding: '8px 10px', color: T.text, fontSize: 12,
            width: '100%', minHeight: 90, resize: 'vertical',
          }} />
      </div>
      <div style={{ padding: 10, background: T.surfaceAlt, borderRadius: 8, border: `1px dashed ${T.border}` }}>
        <div style={{ fontSize: 11, color: T.textSub, fontWeight: 600, marginBottom: 8 }}>選填：附加連結</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Si label="連結網址（http:// 或 https:// 開頭）" val={form.link_url} onChange={v => setForm({ ...form, link_url: v })} flex={1} />
          <Si label="連結按鈕文字（例如：查看詳情、立即報名）" val={form.link_label} onChange={v => setForm({ ...form, link_label: v })} flex={1} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={save} disabled={saving} style={{ background: T.gradBtn, color: '#fff', border: 'none', padding: '8px 22px', borderRadius: 7, fontSize: 12, fontWeight: 600, opacity: saving ? .6 : 1 }}>
          {saving ? '儲存中...' : '儲存公告'}
        </button>
        <button onClick={cancel} style={{ background: 'transparent', color: T.textSub, border: `1px solid ${T.border}`, padding: '8px 22px', borderRadius: 7, fontSize: 12 }}>取消</button>
      </div>
    </div>
  )

  return (
    <div>
      {!editing && (
        <button onClick={startNew} style={{
          background: T.accentSoft, color: T.accent,
          border: `1px dashed rgba(129,140,248,.25)`,
          padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500,
          width: '100%', marginBottom: 12,
        }}>+ 新增公告</button>
      )}

      {editing === 'new' && (
        <Collapsible title="新增公告" defaultOpen>
          {Editor}
        </Collapsible>
      )}

      {ann.length === 0 && editing !== 'new' && (
        <div style={{ textAlign: 'center', padding: 30, color: T.textMuted, background: T.surface, borderRadius: 12, border: `1px solid ${T.border}` }}>
          目前沒有公告，點上方按鈕新增
        </div>
      )}

      {ann.map(a => (
        editing && editing.id === a.id ? (
          <Collapsible key={a.id} title={`編輯：${a.title}`} defaultOpen>
            {Editor}
          </Collapsible>
        ) : (
          <div key={a.id} style={{
            background: T.surface, borderRadius: 10, padding: '12px 16px',
            border: `1px solid ${T.border}`, marginBottom: 6,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{a.title}</div>
                <div style={{ fontSize: 10, color: T.textMuted }}>{new Date(a.published_at).toLocaleString('zh-TW')}</div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <Mb onClick={() => startEdit(a)}>編輯</Mb>
                <Mb onClick={() => del(a)} d>刪除</Mb>
              </div>
            </div>
            {a.body && <div style={{ fontSize: 12, color: T.textSub, lineHeight: 1.6 }}>{a.body}</div>}
            {a.link_url && (
              <div style={{ marginTop: 6, fontSize: 11, color: T.accent, display: 'flex', alignItems: 'center', gap: 4 }}>
                🔗 {a.link_label || '查看詳情'} → <span style={{ color: T.textMuted, fontSize: 10 }}>{a.link_url}</span>
              </div>
            )}
          </div>
        )
      ))}
    </div>
  )
}

// ═══════════ SHARED MICRO COMPONENTS ═══════════
function Mb({ children, onClick, d }) {
  return <button onClick={onClick} style={{
    background: d ? 'rgba(248,113,113,.06)' : 'rgba(255,255,255,.03)',
    color: d ? T.danger : T.textSub, border: `1px solid ${d ? 'rgba(248,113,113,.12)' : T.border}`,
    borderRadius: 5, padding: '1px 6px', fontSize: 10, lineHeight: '16px',
  }}>{children}</button>
}

function Si({ label, val, onChange, flex, w }) {
  return <div style={{ flex: flex || undefined, width: w || undefined, minWidth: 0 }}>
    <div style={{ fontSize: 9, color: T.textMuted, marginBottom: 2 }}>{label}</div>
    <input value={val || ''} onChange={e => onChange(e.target.value)} style={{
      background: 'rgba(255,255,255,.03)', border: `1px solid ${T.border}`,
      borderRadius: 5, padding: '5px 8px', color: T.text, fontSize: 11, width: '100%',
    }} />
  </div>
}
