export default async (req,res)=> { if(req.method!=='POST') return res.status(405).json({}); return res.status(200).json({ success:true }); }
