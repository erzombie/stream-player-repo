export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors() });

  try {
    const url  = new URL(request.url);
    const user = (url.searchParams.get('user') || '').trim();
    if (!user) return json({ error: 'missing user' }, 400);

    const token = await getToken(env);
    const headers = {
      'Client-ID':     env.TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${token}`,
    };

    // users -> id
    const ures = await fetch('https://api.twitch.tv/helix/users?login=' + encodeURIComponent(user), { headers });
    if (!ures.ok) return json({ error: 'users ' + ures.status }, ures.status);
    const uj = await ures.json();
    const u  = uj?.data?.[0];
    if (!u) return json({ error: 'user not found' }, 404);

    // latest clip (best-effort)
    let clip_url = null;
    const cres = await fetch(`https://api.twitch.tv/helix/clips?broadcaster_id=${u.id}&first=1`, { headers });
    if (cres.ok) {
      const cj = await cres.json();
      const c  = cj?.data?.[0];
      if (c) clip_url = c.url || `https://clips.twitch.tv/${c.id}`;
    }

    return json({
      display_name:      u.display_name || u.login,
      profile_image_url: u.profile_image_url,
      clip_url
    });
  } catch (e) {
    return json({ error: 'server', detail: String(e) }, 500);
  }
}

function cors(){ return {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': '*',
};}
function json(obj, status=200){
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type':'application/json', ...cors() }});
}
async function getToken(env){
  if (env.TWITCH_APP_TOKEN) return env.TWITCH_APP_TOKEN; // optional shortcut
  const body = new URLSearchParams({
    client_id:     env.TWITCH_CLIENT_ID,
    client_secret: env.TWITCH_CLIENT_SECRET,
    grant_type:    'client_credentials',
  });
  const r = await fetch('https://id.twitch.tv/oauth2/token', { method:'POST', body });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error('token fail: ' + JSON.stringify(j));
  return j.access_token;
}
