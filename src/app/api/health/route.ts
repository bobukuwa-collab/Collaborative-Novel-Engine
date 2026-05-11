export async function GET() {
  return Response.json(
    { 
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'collaborative-novel-engine'
    },
    { status: 200 }
  )
}