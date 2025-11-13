// npm i cheerio
import cheerio from 'cheerio';

export default async function handler(req, res){
  const target = req.query.url;
  if(!target) return res.status(400).json({error:'url required'});
  try{
    const resp = await fetch(target, { redirect: 'follow' });
    const html = await resp.text();
    const $ = cheerio.load(html);

    const pick = (sel, attr='content') => $(sel).attr(attr) || '';
    const title = pick('meta[property="og:title"]') || pick('meta[name="citation_title"]') || $('title').text() || '';
    const site  = pick('meta[property="og:site_name"]') || new URL(target).hostname.replace(/^www\./,'');
    const publisher = pick('meta[name="citation_publisher"]') || pick('meta[name="publisher"]') || '';
    const date = pick('meta[name="citation_publication_date"]') || pick('meta[property="article:published_time"]') || pick('meta[name="date"]') || '';
    const author = pick('meta[name="author"]') || pick('meta[name="citation_author"]') || pick('meta[name="DC.creator"]') || '';
    let doi = pick('meta[name="citation_doi"]') || pick('meta[property="og:doi"]') || '';
    if (!doi){
      const text = $('body').text();
      const m = text.match(/10\\.[^\\s"<>]+/);
      if (m) doi = m[0];
    }

    // JSON-LD
    let ldAuthor = '';
    $('script[type="application/ld+json"]').each((_, el)=>{
      try{
        const data = JSON.parse($(el).text());
        const blob = Array.isArray(data) ? data : [data];
        const art = blob.find(x => /Article|NewsArticle|ScholarlyArticle/i.test(x?.['@type']||''));
        if (art){
          if (!ldAuthor){
            const a = art.author;
            if (Array.isArray(a) && a[0]?.name) ldAuthor = a.map(p=>p.name).join(', ');
            else if (a?.name) ldAuthor = a.name;
          }
        }
      }catch{}
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.json({
      title, site, publisher, date, author: author || ldAuthor, doi
    });
  }catch(err){
    return res.status(500).json({error:String(err)});
  }
}
