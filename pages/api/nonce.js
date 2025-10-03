export default (req,res)=>res.status(200).json({ nonce: (Math.random().toString(36).slice(2)+Date.now().toString(36)).slice(0,16) });
