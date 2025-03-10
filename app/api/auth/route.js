import bcrypt from "bcrypt";

export async function POST(req) {
  try {
    const { password } = await req.json();

    const hashedPassword = process.env.DEPLOYMENT_PASSWORD;
    console.log("hashedPassword", hashedPassword);

    if (!hashedPassword) {
      return new Response(JSON.stringify({ error: "Server error: password not set" }), { status: 500 });
    }

    // Compare input password with hashed password
    const isMatch = await bcrypt.compare(password, hashedPassword);

    if (!isMatch) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });
    }

    return new Response(JSON.stringify({ success: true, message: "Login successful" }), { status: 200 });

  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
