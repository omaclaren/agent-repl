! Setup
use fplotlib
integer, parameter :: n = 6000
real(8) :: t(0:n)
integer :: i
do i = 0, n
  t(i) = i*0.005d0
end do

! One RK4 step of the Lorenz system, in scalars.
subroutine rk4(x, y, z, h)
  real(8), intent(inout) :: x, y, z
  real(8), intent(in) :: h
  real(8) :: k(4, 3), u, v, w, c
  integer :: j
  u = x; v = y; w = z
  do j = 1, 4
    k(j, :) = [10*(v-u), u*(28-w)-v, u*v-8*w/3]
    c = merge(1d0, 0.5d0, j == 3)*h
    u = x + c*k(j, 1); v = y + c*k(j, 2); w = z + c*k(j, 3)
  end do
  x = x + h/6*(k(1, 1) + 2*k(2, 1) + 2*k(3, 1) + k(4, 1))
  y = y + h/6*(k(1, 2) + 2*k(2, 2) + 2*k(3, 2) + k(4, 2))
  z = z + h/6*(k(1, 3) + 2*k(2, 3) + 2*k(3, 3) + k(4, 3))
end subroutine

! The orbit from (x0, 1, 1) at t(0:n).
subroutine orbit(x0, x, y, z)
  real(8), intent(in) :: x0
  real(8), intent(out) :: x(0:6000), y(0:6000), z(0:6000)
  integer :: i
  x(0) = x0; y(0) = 1; z(0) = 1
  do i = 1, 6000
    x(i) = x(i-1); y(i) = y(i-1); z(i) = z(i-1)
    call rk4(x(i), y(i), z(i), 0.005d0)
  end do
end subroutine

! Pi
real(8) :: x(0:n), y(0:n), z(0:n)
call orbit(1d0, x, y, z)
call figure()
call scatter(x, z, s=1d0)
call xlabel("x")
call ylabel("z")
call savefig("butterfly.png")

! Demo operator
real(8) :: x2(0:n), y2(0:n), z2(0:n); call orbit(1.0001d0, x2, y2, z2)

! Claude Code
real(8) :: d(0:n)
d = sqrt((x - x2)**2 + (y - y2)**2 + (z - z2)**2)
call figure()
call semilogy(t, d)
call xlabel("Time")
call ylabel("Separation")
call savefig("separation.png")
