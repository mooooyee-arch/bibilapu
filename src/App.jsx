import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase.js'

// ═══════════════════════════════════════════════════
//  比比拉普 BIBILAPU — Full Supabase Version
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
  grad: 'linear-gradient(135deg,#818CF8 0%,#C084FC 50%,#F472B6 100%)',
  gradBtn: 'linear-gradient(135deg,#6366F1 0%,#8B5CF6 100%)',
}

const STATUS = {
  pending: { label: '待確認', color: T.warn, icon: '⏳' },
  accepted: { label: '進行中', color: '#60A5FA', icon: '🎮' },
  completed: { label: '已完成', color: T.success, icon: '✅' },
  cancelled: { label: '已取消', color: T.danger, icon: '❌' },
}

function useIsDesktop(bp = 860) {
  const [d, setD] = useState(window.innerWidth >= bp)
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
  const [orders, setOrders] = useState([])
  const [ann, setAnn] = useState([])
  const [showAuth, setShowAuth] = useState(false)
  const [loading, setLoading] = useState(true)
  const isDesktop = useIsDesktop()

  // ── Init: check session + load data ──
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await loadProfile(session.user.id)
      }
      await loadCatalog()
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

  // ── Load profile ──
  const loadProfile = async (uid) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    if (data) setProfile(data)
  }

  // ── Load catalog ──
  const loadCatalog = async () => {
    const { data } = await supabase.from('catalog').select('*').order('sort_order')
    if (data) {
      setCatalog(data)
      setCatalogTree(buildTree(data))
    }
  }

  // ── Load announcements ──
  const loadAnnouncements = async () => {
    const { data } = await supabase.from('announcements').select('*').order('published_at', { ascending: false })
    if (data) setAnn(data)
  }

  // ── Load orders ──
  const loadOrders = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
    if (data) setOrders(data)
  }, [user])

  useEffect(() => { if (user) loadOrders() }, [user, loadOrders])

  // ── Add order ──
  const addOrder = async (o) => {
    const { error } = await supabase.from('orders').insert({
      user_id: user.id,
      catalog_item_id: o.catalogItemId || null,
      game_name: o.game,
      game_icon: o.gameIcon,
      service_path: o.service,
      price: o.price,
      note: o.note,
      status: 'pending',
    })
    if (!error) {
      await loadOrders()
      setPage('profile')
    }
  }

  // ── Logout ──
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
        input:focus,textarea:focus{border-color:${T.accent}!important;outline:none;box-shadow:0 0 0 3px ${T.accentSoft}}
        button{font-family:'Noto Sans TC','Sora',sans-serif;cursor:pointer}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .fu{animation:fadeUp .45s ease both}.fi{animation:fadeIn .4s ease both}
        .hlift{transition:transform .2s,box-shadow .2s,border-color .2s}
        .hlift:hover{transform:translateY(-3px);box-shadow:0 12px 32px rgba(0,0,0,.4);border-color:${T.borderLight}!important}
        .game-card{position:relative;overflow:hidden}
        .game-card::after{content:'';position:absolute;inset:0;opacity:0;transition:opacity .3s;background:radial-gradient(circle at var(--mx,50%) var(--my,50%),rgba(255,255,255,.06),transparent 60%);pointer-events:none}
        .game-card:hover::after{opacity:1}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', background: T.gradBtn,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'Sora',
            }}>{(profile?.name || user.email)[0]}</div>
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

      <div style={{ maxWidth: page === 'order' && isDesktop ? 1200 : 1060, margin: '0 auto', padding: isDesktop ? '32px 24px 80px' : '24px 14px 80px' }}>
        {page === 'home' && <HomePage ann={ann} catalog={catalogTree} go={setPage} isDesktop={isDesktop} />}
        {page === 'order' && (
          isDesktop
            ? <DesktopOrder catalog={catalogTree} user={user} addOrder={addOrder} auth={() => setShowAuth(true)} />
            : <MobileOrder catalog={catalogTree} user={user} addOrder={addOrder} auth={() => setShowAuth(true)} />
        )}
        {page === 'profile' && user && <ProfilePage profile={profile} orders={orders} isDesktop={isDesktop} loadOrders={loadOrders} />}
        {page === 'admin' && isAdmin && <AdminPage catalog={catalog} catalogTree={catalogTree} reload={loadCatalog} orders={orders} loadOrders={loadOrders} />}
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
      options: {
        redirectTo: window.location.origin,
      }
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
        <h2 style={{ fontFamily: 'Sora', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
          登入比比拉普
        </h2>
        <p style={{ color: T.textSub, fontSize: 13, marginBottom: 24 }}>
          使用 Discord 帳號快速登入
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {err && <div style={{ color: T.danger, fontSize: 12 }}>{err}</div>}
          <button onClick={loginWithDiscord} disabled={busy} style={{
            background: '#5865F2', color: '#fff', border: 'none',
            padding: '13px 20px', borderRadius: 12, fontSize: 15, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            opacity: busy ? .6 : 1, transition: 'opacity .2s',
            boxShadow: '0 4px 16px rgba(88,101,242,.3)',
          }}>
            <svg width="20" height="15" viewBox="0 0 71 55" fill="none">
              <path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.4 37.4 0 0025.4.3a.2.2 0 00-.2-.1A58.4 58.4 0 0010.5 4.9a.2.2 0 00-.1.1C1.5 18.7-.9 32.2.3 45.5v.1a58.7 58.7 0 0017.7 9a.2.2 0 00.3-.1 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.7 38.7 0 01-5.5-2.6.2.2 0 010-.4c.4-.3.7-.6 1.1-.8a.2.2 0 01.2 0c11.5 5.3 24 5.3 35.4 0a.2.2 0 01.3 0l1 .9a.2.2 0 010 .3 36.3 36.3 0 01-5.5 2.6.2.2 0 00-.1.4 47.2 47.2 0 003.6 5.8.2.2 0 00.3.1 58.5 58.5 0 0017.7-9v-.1c1.4-15-2.3-28.4-9.8-40.1a.2.2 0 00-.1-.1zM23.7 37.3c-3.5 0-6.3-3.2-6.3-7s2.8-7 6.3-7 6.4 3.2 6.3 7-2.8 7-6.3 7zm23.2 0c-3.5 0-6.3-3.2-6.3-7s2.8-7 6.3-7 6.4 3.2 6.3 7-2.8 7-6.3 7z" fill="white"/>
            </svg>
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

// ═══════════ HOME ═══════════
function HomePage({ ann, catalog, go, isDesktop }) {
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
        {ann.map(a => (
          <div key={a.id} style={{
            background: T.surface, borderRadius: 12, padding: isDesktop ? '20px 24px' : '16px 18px',
            border: `1px solid ${T.border}`, marginBottom: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{a.title}</span>
              <span style={{ color: T.textMuted, fontSize: 11 }}>{new Date(a.published_at).toLocaleDateString('zh-TW')}</span>
            </div>
            <p style={{ color: T.textSub, fontSize: 13, lineHeight: 1.6 }}>{a.body}</p>
          </div>
        ))}
      </Sec>

      <Sec title="🎮 支援遊戲">
        <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? `repeat(${Math.min(catalog.length, 5)},1fr)` : 'repeat(auto-fill,minmax(140px,1fr))', gap: isDesktop ? 14 : 10 }}>
          {catalog.map(g => (
            <div key={g.id} onClick={() => go('order')} className="hlift fu game-card"
              onMouseMove={e => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--mx', ((e.clientX-r.left)/r.width*100)+'%'); e.currentTarget.style.setProperty('--my', ((e.clientY-r.top)/r.height*100)+'%') }}
              style={{
                background: T.surface, borderRadius: 14,
                padding: isDesktop ? '32px 16px' : '22px 12px',
                border: `1px solid ${T.border}`, cursor: 'pointer', textAlign: 'center',
              }}>
              <div style={{ fontSize: isDesktop ? 40 : 30, marginBottom: 10 }}>{g.icon || '🎮'}</div>
              <div style={{ fontSize: isDesktop ? 15 : 13, fontWeight: 700 }}>{g.name}</div>
              <div style={{ width: 24, height: 3, borderRadius: 2, margin: '10px auto 0', background: g.color || T.accent, opacity: .7 }} />
            </div>
          ))}
        </div>
      </Sec>

      <Sec title="👾 團隊成員">
        <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(6,1fr)' : 'repeat(auto-fill,minmax(120px,1fr))', gap: 10 }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{
              background: T.surface, borderRadius: 12, padding: 18,
              border: `1px solid ${T.border}`, textAlign: 'center', opacity: .35,
            }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', margin: '0 auto 8px', background: T.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👤</div>
              <div style={{ fontSize: 12, color: T.textMuted }}>待綁定</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 12, padding: 14, background: T.accentSoft, borderRadius: 10, border: `1px dashed rgba(129,140,248,.2)`, fontSize: 12, color: T.textSub }}>
          🔗 員工資料將透過 App 自動同步
        </div>
      </Sec>
    </div>
  )
}
function Sec({ title, children }) {
  return <div style={{ marginBottom: 36 }}><h2 style={{ fontFamily: 'Sora', fontSize: 18, fontWeight: 700, marginBottom: 14 }}>{title}</h2>{children}</div>
}

// ═══════════ DESKTOP ORDER ═══════════
function DesktopOrder({ catalog, user, addOrder, auth }) {
  const [selGame, setSelGame] = useState(0)
  const [path, setPath] = useState([])
  const [note, setNote] = useState('')
  const [hoverIdx, setHoverIdx] = useState(null)

  const game = catalog[selGame]
  let currentItems = game?.children || []
  const breadcrumb = [game]
  for (let i = 0; i < path.length; i++) {
    const node = currentItems[path[i]]
    breadcrumb.push(node)
    currentItems = node?.children || []
  }
  const currentNode = breadcrumb[breadcrumb.length - 1]
  const isLeaf = path.length > 0 && (!currentNode?.children?.length) && currentNode?.price

  const handleOrder = () => {
    if (!user) { auth(); return }
    addOrder({
      catalogItemId: currentNode?.id, game: game.name, gameIcon: game.icon || '🎮',
      service: breadcrumb.slice(1).map(b => b.name).join(' › '),
      price: currentNode?.price || '', note,
    })
    setPath([]); setNote('')
  }

  return (
    <div className="fu" style={{ display: 'grid', gridTemplateColumns: '220px 1fr 320px', gap: 16, minHeight: 'calc(100vh - 140px)' }}>
      {/* LEFT */}
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
            <span style={{ fontSize: 22 }}>{g.icon || '🎮'}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: selGame === i ? 700 : 500, color: selGame === i ? T.text : T.textSub }}>{g.name}</div>
              <div style={{ fontSize: 10, color: T.textMuted }}>{g.children?.length || 0} 個分類</div>
            </div>
            {selGame === i && <div style={{ position: 'absolute', left: 0, top: '20%', height: '60%', width: 3, borderRadius: '0 2px 2px 0', background: g.color || T.accent }} />}
          </div>
        ))}
      </div>

      {/* CENTER */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, padding: '14px 18px', background: T.surface, borderRadius: 12, border: `1px solid ${T.border}` }}>
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
          <div className="fi" style={{ background: T.surface, borderRadius: 16, border: `1px solid ${T.border}`, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{game?.icon}</div>
            <h3 style={{ fontFamily: 'Sora', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{currentNode.name}</h3>
            {currentNode.description && <p style={{ color: T.textSub, fontSize: 14, marginBottom: 16 }}>{currentNode.description}</p>}
            <div style={{ display: 'inline-block', background: T.accentSoft, color: T.accent, padding: '8px 24px', borderRadius: 20, fontWeight: 700, fontSize: 18, border: `1px solid rgba(129,140,248,.2)` }}>{currentNode.price}</div>
            <button onClick={() => setPath(path.slice(0, -1))} style={{ display: 'block', margin: '20px auto 0', background: 'transparent', color: T.textSub, border: 'none', fontSize: 13 }}>← 返回上一層</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: (currentItems.length <= 2 ? '1fr 1fr' : 'repeat(auto-fill,minmax(220px,1fr))'), gap: 12 }}>
            {currentItems.map((item, idx) => {
              const hasKids = item.children?.length > 0
              const isH = hoverIdx === idx
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
                  <div style={{ fontSize: 13, color: T.textMuted, fontWeight: 500, marginBottom: 6 }}>{hasKids ? `${item.children.length} 項服務` : '服務項目'}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, fontFamily: 'Sora' }}>{item.name}</div>
                  {item.description && <div style={{ fontSize: 12, color: T.textSub, marginBottom: 10, lineHeight: 1.5 }}>{item.description}</div>}
                  {item.price && <div style={{ display: 'inline-block', background: T.accentSoft, color: T.accent, padding: '4px 14px', borderRadius: 16, fontSize: 12, fontWeight: 600, border: `1px solid rgba(129,140,248,.15)` }}>{item.price}</div>}
                  <div style={{ position: 'absolute', bottom: 16, right: 16, color: isH ? T.accent : T.textMuted, fontSize: 18, transition: 'all .2s', transform: isH ? 'translateX(3px)' : 'none' }}>{hasKids ? '›' : '→'}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* RIGHT */}
      <div style={{ background: T.surface, borderRadius: 16, border: `1px solid ${T.border}`, padding: 24, alignSelf: 'start', position: 'sticky', top: 76 }}>
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
        {isLeaf && currentNode?.price && (
          <div className="fi" style={{ textAlign: 'center', padding: 16, marginBottom: 16, background: `linear-gradient(135deg,${T.accentSoft},rgba(192,132,252,.08))`, borderRadius: 12, border: `1px solid rgba(129,140,248,.15)` }}>
            <div style={{ fontSize: 11, color: T.textSub, marginBottom: 4 }}>價格</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Sora', color: T.accent }}>{currentNode.price}</div>
          </div>
        )}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 6 }}>備註說明</div>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="目前段位、期望段位、偏好角色..."
            style={{ background: 'rgba(255,255,255,.03)', border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', color: T.text, fontSize: 13, width: '100%', minHeight: 80, resize: 'vertical' }} />
        </div>
        <button onClick={handleOrder} disabled={!isLeaf}
          style={{ background: isLeaf ? T.gradBtn : T.surfaceAlt, color: isLeaf ? '#fff' : T.textMuted, border: 'none', padding: '13px', borderRadius: 12, width: '100%', fontSize: 14, fontWeight: 600, boxShadow: isLeaf ? `0 4px 20px ${T.accentGlow}` : 'none', opacity: isLeaf ? 1 : .5 }}>
          {!user ? '請先登入' : isLeaf ? '確認送出 ✓' : '請選擇服務項目'}
        </button>
      </div>
    </div>
  )
}

// ═══════════ MOBILE ORDER ═══════════
function MobileOrder({ catalog, user, addOrder, auth }) {
  const [path, setPath] = useState([])
  const [note, setNote] = useState('')

  let currentItems = catalog
  const breadcrumb = []
  for (let i = 0; i < path.length; i++) {
    const node = currentItems[path[i]]
    breadcrumb.push(node)
    currentItems = node?.children || []
  }
  const currentNode = breadcrumb[breadcrumb.length - 1]
  const isLeaf = breadcrumb.length > 0 && (!currentNode?.children?.length) && currentNode?.price

  const handleOrder = () => {
    if (!user) { auth(); return }
    addOrder({
      catalogItemId: currentNode?.id, game: breadcrumb[0]?.name || '', gameIcon: breadcrumb[0]?.icon || '🎮',
      service: breadcrumb.slice(1).map(b => b.name).join(' › '),
      price: currentNode?.price || '', note,
    })
    setPath([]); setNote('')
  }

  return (
    <div>
      <h1 className="fu" style={{ fontFamily: 'Sora', fontSize: 24, fontWeight: 800, textAlign: 'center', marginBottom: 4 }}>下單委託</h1>
      <p className="fu" style={{ textAlign: 'center', color: T.textSub, fontSize: 13, marginBottom: 20 }}>
        {path.length === 0 ? '選擇遊戲' : isLeaf ? '確認訂單' : '選擇項目'}
      </p>
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
        <div className="fu" style={{ background: T.surface, borderRadius: 14, padding: 22, border: `1px solid ${T.border}` }}>
          <h3 style={{ fontFamily: 'Sora', fontSize: 16, fontWeight: 700, marginBottom: 14 }}>確認訂單</h3>
          <InfoRow label="遊戲" val={`${breadcrumb[0]?.icon || ''} ${breadcrumb[0]?.name}`} />
          <InfoRow label="服務" val={breadcrumb.slice(1).map(b => b.name).join(' › ')} />
          <InfoRow label="價格" val={currentNode.price} hl />
          {currentNode.description && <InfoRow label="說明" val={currentNode.description} />}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: T.textSub, marginBottom: 5 }}>備註</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="目前段位、期望等..."
              style={{ background: 'rgba(255,255,255,.03)', border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', color: T.text, fontSize: 13, width: '100%', minHeight: 60, resize: 'vertical' }} />
          </div>
          <button onClick={handleOrder} style={{ background: T.gradBtn, color: '#fff', border: 'none', padding: '12px', borderRadius: 10, width: '100%', fontSize: 14, fontWeight: 600, marginTop: 14, boxShadow: `0 4px 16px ${T.accentGlow}` }}>
            {user ? '確認送出 ✓' : '請先登入'}
          </button>
          <button onClick={() => setPath(path.slice(0, -1))} style={{ display: 'block', margin: '10px auto 0', background: 'transparent', color: T.textSub, border: 'none', fontSize: 12 }}>← 返回</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: path.length === 0 ? 'repeat(auto-fill,minmax(140px,1fr))' : '1fr', gap: 8 }}>
          {currentItems.map((item, idx) => {
            const isGame = path.length === 0
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
                    <span style={{ fontSize: 28 }}>{item.icon || '🎮'}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</span>
                    <div style={{ width: 20, height: 2, borderRadius: 1, background: item.color || T.accent, opacity: .6 }} />
                  </>
                ) : (
                  <>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                      {item.description && <div style={{ color: T.textSub, fontSize: 11, marginTop: 2 }}>{item.description}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {item.price && <span style={{ color: T.accent, fontWeight: 600, fontSize: 12 }}>{item.price}</span>}
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
    <span style={{ fontWeight: 600, fontSize: 12, color: hl ? T.accent : T.text, textAlign: 'right', maxWidth: '60%' }}>{val}</span>
  </div>
}

// ═══════════ PROFILE ═══════════
function ProfilePage({ profile, orders, isDesktop, loadOrders }) {
  const [gmail, setGmail] = useState(profile?.gmail || '')
  const [gmailSaved, setGmailSaved] = useState(false)
  const [gmailEditing, setGmailEditing] = useState(false)
  const [cancelling, setCancelling] = useState(null)

  const cancelOrder = async (id) => {
    if (!confirm('確定要取消這筆訂單嗎？')) return
    setCancelling(id)
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', id)
    await loadOrders()
    setCancelling(null)
  }

  const saveGmail = async () => {
    const { error } = await supabase.from('profiles').update({ gmail }).eq('id', profile.id)
    if (!error) { setGmailSaved(true); setGmailEditing(false); setTimeout(() => setGmailSaved(false), 2000) }
  }

  const discordName = profile?.name || '用戶'
  const avatarUrl = profile?.avatar_url

  return (
    <div>
      <div className="fu" style={{ background: T.surface, borderRadius: 16, padding: isDesktop ? 28 : 22, border: `1px solid ${T.border}`, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          {avatarUrl ? (
            <img src={avatarUrl} style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: T.gradBtn, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#fff', fontFamily: 'Sora', flexShrink: 0 }}>{discordName[0]}</div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Sora' }}>{discordName}</div>
            <div style={{ color: T.textSub, fontSize: 12, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="11" viewBox="0 0 71 55" fill="none"><path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.4 37.4 0 0025.4.3a.2.2 0 00-.2-.1A58.4 58.4 0 0010.5 4.9a.2.2 0 00-.1.1C1.5 18.7-.9 32.2.3 45.5v.1a58.7 58.7 0 0017.7 9a.2.2 0 00.3-.1 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.7 38.7 0 01-5.5-2.6.2.2 0 010-.4c.4-.3.7-.6 1.1-.8a.2.2 0 01.2 0c11.5 5.3 24 5.3 35.4 0a.2.2 0 01.3 0l1 .9a.2.2 0 010 .3 36.3 36.3 0 01-5.5 2.6.2.2 0 00-.1.4 47.2 47.2 0 003.6 5.8.2.2 0 00.3.1 58.5 58.5 0 0017.7-9v-.1c1.4-15-2.3-28.4-9.8-40.1a.2.2 0 00-.1-.1zM23.7 37.3c-3.5 0-6.3-3.2-6.3-7s2.8-7 6.3-7 6.4 3.2 6.3 7-2.8 7-6.3 7zm23.2 0c-3.5 0-6.3-3.2-6.3-7s2.8-7 6.3-7 6.4 3.2 6.3 7-2.8 7-6.3 7z" fill="#5865F2"/></svg>
              Discord 登入
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Sora' }}>{orders.length}</div>
            <div style={{ fontSize: 11, color: T.textSub }}>總訂單</div>
          </div>
        </div>

        {/* Gmail 綁定區塊 */}
        <div style={{
          background: T.surfaceAlt, borderRadius: 12, padding: '14px 18px',
          border: `1px solid ${T.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: gmailEditing ? 10 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>📧</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>
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
      <Sec title="📋 我的訂單">
        {orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: T.textMuted, background: T.surface, borderRadius: 14, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div><div style={{ fontSize: 14 }}>目前沒有訂單</div>
          </div>
        ) : orders.map(o => {
          const st = STATUS[o.status]
          return (
            <div key={o.id} style={{ background: T.surface, borderRadius: 12, padding: '16px 18px', border: `1px solid ${T.border}`, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{o.game_icon || '🎮'}</span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{o.game_name}</span>
                </div>
                <span style={{ background: `${st.color}15`, color: st.color, padding: '3px 10px', borderRadius: 16, fontSize: 11, fontWeight: 600 }}>{st.icon} {st.label}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: T.textSub }}>{o.service_path}</span>
                <span style={{ color: T.accent, fontWeight: 600 }}>{o.price}</span>
              </div>
              {o.note && <div style={{ marginTop: 6, fontSize: 12, color: T.textMuted }}>💬 {o.note}</div>}
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: T.textMuted }}>#{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleString('zh-TW')}</span>
                {(o.status === 'pending') && (
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
      </Sec>
    </div>
  )
}

// ═══════════ ADMIN ═══════════
function AdminPage({ catalog, catalogTree, reload, orders, loadOrders }) {
  const [tab, setTab] = useState('catalog')
  return (
    <div>
      <h1 className="fu" style={{ fontFamily: 'Sora', fontSize: 22, fontWeight: 800, marginBottom: 6 }}>⚙️ 後台管理</h1>
      <p style={{ color: T.textSub, fontSize: 13, marginBottom: 18 }}>管理品項目錄與訂單</p>
      <div style={{ display: 'flex', gap: 4, marginBottom: 18 }}>
        {[{ k: 'catalog', l: '品項管理' }, { k: 'orders', l: '訂單管理' }].map(t => (
          <button key={t.k} onClick={() => { setTab(t.k); if (t.k === 'orders') loadOrders() }} style={{
            background: tab === t.k ? T.accentSoft : 'transparent', color: tab === t.k ? T.accent : T.textSub,
            border: `1px solid ${tab === t.k ? 'rgba(129,140,248,.2)' : 'transparent'}`,
            padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          }}>{t.l}</button>
        ))}
      </div>
      {tab === 'catalog' && <CatalogAdmin catalog={catalog} tree={catalogTree} reload={reload} />}
      {tab === 'orders' && <OrderAdmin orders={orders} loadOrders={loadOrders} />}
    </div>
  )
}

function CatalogAdmin({ catalog, tree, reload }) {
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({})

  const startEdit = (node) => {
    setEditId(node.id)
    setForm({ name: node.name, icon: node.icon || '', color: node.color || '', price: node.price || '', description: node.description || '', sort_order: node.sort_order || 0 })
  }

  const saveEdit = async () => {
    await supabase.from('catalog').update(form).eq('id', editId)
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

  const renderTree = (nodes, depth = 0) => {
    const dc = ['#818CF8', '#C084FC', '#F472B6', '#FBBF24', '#34D399']
    return (
      <div style={{ marginLeft: depth > 0 ? 14 : 0 }}>
        {nodes.map((n, i) => (
          <div key={n.id} style={{ marginBottom: 3 }}>
            <div style={{
              background: T.surface, borderRadius: 8, borderLeft: `3px solid ${n.color || dc[depth % 5]}`,
              border: `1px solid ${T.border}`, padding: editId === n.id ? '10px 12px' : '7px 12px',
              display: 'flex', flexDirection: 'column', gap: editId === n.id ? 8 : 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {n.children?.length > 0 && <span style={{ fontSize: 9, color: T.textMuted }}>▼</span>}
                {depth === 0 && <span style={{ fontSize: 14 }}>{n.icon || '🎮'}</span>}
                <span style={{ flex: 1, fontSize: 12, fontWeight: depth === 0 ? 700 : 500 }}>{n.name}</span>
                {n.price && <span style={{ fontSize: 10, color: T.accent, fontWeight: 600 }}>{n.price}</span>}
                <div style={{ display: 'flex', gap: 2 }}>
                  <Mb onClick={() => startEdit(n)}>✎</Mb>
                  <Mb onClick={() => addChild(n.id)}>+</Mb>
                  <Mb onClick={() => deleteNode(n.id, n.name)} d>✕</Mb>
                </div>
              </div>
              {editId === n.id && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 18 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Si label="名稱" val={form.name} onChange={v => setForm({ ...form, name: v })} flex={2} />
                    {depth === 0 && <Si label="圖示" val={form.icon} onChange={v => setForm({ ...form, icon: v })} w={55} />}
                    {depth === 0 && <Si label="色碼" val={form.color} onChange={v => setForm({ ...form, color: v })} w={75} />}
                    <Si label="排序" val={String(form.sort_order)} onChange={v => setForm({ ...form, sort_order: parseInt(v) || 0 })} w={55} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Si label="價格" val={form.price} onChange={v => setForm({ ...form, price: v })} flex={1} />
                    <Si label="說明" val={form.description} onChange={v => setForm({ ...form, description: v })} flex={2} />
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={saveEdit} style={{ background: T.gradBtn, color: '#fff', border: 'none', padding: '5px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>儲存</button>
                    <button onClick={() => setEditId(null)} style={{ background: 'transparent', color: T.textSub, border: `1px solid ${T.border}`, padding: '5px 14px', borderRadius: 6, fontSize: 11 }}>取消</button>
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
      {renderTree(tree)}
      <button onClick={() => addChild(null)} style={{ background: T.accentSoft, color: T.accent, border: `1px dashed rgba(129,140,248,.25)`, padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500, width: '100%', marginTop: 8 }}>+ 新增遊戲</button>
    </div>
  )
}

function OrderAdmin({ orders, loadOrders }) {
  const updateStatus = async (id, status) => {
    await supabase.from('orders').update({ status }).eq('id', id)
    loadOrders()
  }
  return (
    <div>
      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: T.textMuted, background: T.surface, borderRadius: 14, border: `1px solid ${T.border}` }}>目前沒有訂單</div>
      ) : orders.map(o => {
        const st = STATUS[o.status]
        return (
          <div key={o.id} style={{ background: T.surface, borderRadius: 10, padding: '14px 16px', border: `1px solid ${T.border}`, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>{o.game_icon || '🎮'}</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{o.game_name}</span>
                <span style={{ color: T.textSub, fontSize: 11 }}>— {o.service_path}</span>
              </div>
              <span style={{ background: `${st.color}15`, color: st.color, padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600 }}>{st.icon} {st.label}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.textMuted, marginBottom: 6 }}>
              <span>#{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleString('zh-TW')}</span>
              <span style={{ color: T.accent, fontWeight: 600 }}>{o.price}</span>
            </div>
            {o.note && <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>💬 {o.note}</div>}
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
        )
      })}
    </div>
  )
}

function Mb({ children, onClick, d }) {
  return <button onClick={onClick} style={{
    background: d ? 'rgba(248,113,113,.06)' : 'rgba(255,255,255,.03)',
    color: d ? T.danger : T.textSub, border: `1px solid ${d ? 'rgba(248,113,113,.12)' : T.border}`,
    borderRadius: 5, padding: '1px 6px', fontSize: 10, lineHeight: '16px',
  }}>{children}</button>
}
function Si({ label, val, onChange, flex, w }) {
  return <div style={{ flex: flex || undefined, width: w || undefined }}>
    <div style={{ fontSize: 9, color: T.textMuted, marginBottom: 2 }}>{label}</div>
    <input value={val} onChange={e => onChange(e.target.value)} style={{
      background: 'rgba(255,255,255,.03)', border: `1px solid ${T.border}`,
      borderRadius: 5, padding: '5px 8px', color: T.text, fontSize: 11, width: '100%',
    }} />
  </div>
}
