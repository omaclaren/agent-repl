! Setup
use fplotlib
integer, parameter :: n = 6000
real(8) :: t(0:n)
integer :: i
do i = 0, n
  t(i) = i*0.005d0
end do

! The right-hand side of the Lorenz system.
function lorenz(u) result(f)
  real(8), intent(in) :: u(3)
  real(8) :: f(3)
  f = [10*(u(2)-u(1)), u(1)*(28-u(3))-u(2), u(1)*u(2)-8*u(3)/3]
end function

! The orbit from (x0, 1, 1) at t(0:n), by RK4.
subroutine orbit(x0, u)
  real(8), intent(in) :: x0
  real(8), intent(out) :: u(3, 0:6000)
  real(8) :: k1(3), k2(3), k3(3), k4(3), h
  integer :: i
  h = 0.005d0
  u(:, 0) = [x0, 1d0, 1d0]
  do i = 1, 6000
    k1 = lorenz(u(:, i-1))
    k2 = lorenz(u(:, i-1) + h/2*k1)
    k3 = lorenz(u(:, i-1) + h/2*k2)
    k4 = lorenz(u(:, i-1) + h*k3)
    u(:, i) = u(:, i-1) + h/6*(k1 + 2*k2 + 2*k3 + k4)
  end do
end subroutine

! Pi
real(8) :: a(3, 0:n)
call orbit(1d0, a)
call figure()
call plot(a(1, :), a(3, :))
call xlabel("x")
call ylabel("z")
call savefig("butterfly.png")

! Demo operator
real(8) :: b(3, 0:n); call orbit(1.0001d0, b)

! Claude Code
real(8) :: d(0:n)
d = norm2(a - b, dim=1)
call figure()
call semilogy(t, d)
call xlabel("Time")
call ylabel("Separation")
call savefig("separation.png")
