import { getCurrentAccount } from "@/lib/server/account/dal";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

/** Who is signed in (for the header and the checkout prefill); never cached */
export async function GET(): Promise<Response> {
  const context = await getCurrentAccount();
  if (!context) return Response.json({ authenticated: false }, { headers });
  const { account, customer } = context;
  return Response.json(
    {
      authenticated: true,
      profile: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: account.phone,
        email: account.email,
        city: customer.city ?? "",
        address: customer.address ?? "",
      },
    },
    { headers },
  );
}
